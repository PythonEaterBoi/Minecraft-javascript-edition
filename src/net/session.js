// Multiplayer without a server. Two transports share one message protocol:
//
//  * BroadcastChannel — instant co-op between tabs/windows of the same browser
//    on the same origin. Zero setup, no network at all.
//  * WebRTC data channels — real peer-to-peer play across devices, using
//    copy/paste invite codes instead of a signalling server.
//
// The session is transport agnostic: it exposes joinRoom()/hostOffer()/
// acceptOffer()/acceptAnswer(), sendState()/sendEdit()/sendTime() and a set of
// callbacks the game wires into world loading and remote avatars.

const CHANNEL_PREFIX = 'mje-mp-';
const DISCOVERY_CHANNEL = 'mje-mp-discovery';
const PEER_TIMEOUT = 9000;
const ICE_TIMEOUT = 4000;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const randomId = () => Math.random().toString(36).slice(2, 10);

function encodeDescription(description) {
  return btoa(JSON.stringify(description));
}

function decodeDescription(code) {
  return JSON.parse(atob(String(code).replace(/\s+/g, '')));
}

/** Resolve once ICE gathering finishes (or after `timeout` ms). */
function waitForIce(pc, timeout = ICE_TIMEOUT) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      pc.removeEventListener('icecandidate', onCandidate);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    const onCandidate = (event) => {
      if (!event.candidate) finish();
    };
    const timer = setTimeout(finish, timeout);
    pc.addEventListener('icegatheringstatechange', onChange);
    pc.addEventListener('icecandidate', onCandidate);
  });
}

export class MultiplayerSession {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.mode = null; // 'local' | 'p2p'
    this.isHost = false;
    this.selfId = randomId();
    this.since = Date.now();
    this.name = 'Player';
    this.room = '';
    this.peers = new Map();
    this.channel = null;
    this.pc = null;
    this.dc = null;
    this.timers = [];
    this.worldSynced = false;
    this.statusState = 'idle';
    this.statusText = 'Not connected';
    this.closed = false;

    this._onPageHide = () => this.leave(false);
    window.addEventListener('pagehide', this._onPageHide);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  get connected() {
    return this.peers.size > 0;
  }

  get playerCount() {
    return this.peers.size + 1;
  }

  isAuthority() {
    if (this.mode === 'p2p') return this.isHost;
    return this._authorityId() === this.selfId;
  }

  setName(name) {
    this.name = String(name || 'Player').slice(0, 16) || 'Player';
    if (this.mode === 'local' && this.channel) this._post({ t: 'hello' });
    else if (this.dc && this.dc.readyState === 'open') this._send({ t: 'hello' });
  }

  /** Join a BroadcastChannel room (same browser, same origin). */
  joinRoom(room, name) {
    if (typeof BroadcastChannel !== 'function') {
      this._status('error', 'This browser cannot open local multiplayer rooms.');
      return;
    }
    this._reset();
    this.mode = 'local';
    this.room = String(room || 'coop').slice(0, 24);
    this.name = String(name || this.name).slice(0, 16) || 'Player';
    this.since = Date.now();
    this.channel = new BroadcastChannel(CHANNEL_PREFIX + this.room);
    this.channel.onmessage = (event) => this._receive(event.data);
    this._openDiscovery();
    this._post({ t: 'join' });
    this._status('waiting', `In room “${this.room}” — open this page in another tab to play together.`);
    this.timers.push(setInterval(() => this._post({ t: 'hello' }), 2000));
    this.timers.push(setInterval(() => this._prunePeers(), 2000));
  }

  /** Create a WebRTC invite for a friend and return the invite code. */
  async hostOffer(name) {
    if (typeof RTCPeerConnection !== 'function') {
      this._status('error', 'This browser does not support peer-to-peer connections.');
      throw new Error('WebRTC unavailable');
    }
    this._reset();
    this.mode = 'p2p';
    this.isHost = true;
    this.name = String(name || this.name).slice(0, 16) || 'Player';
    this.since = Date.now();

    const pc = this._newPeerConnection();
    this.pc = pc;
    this._wireChannel(pc.createDataChannel('mje', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIce(pc);
    this._status('waiting', 'Invite ready — send it to your friend, then paste their answer below.');
    return encodeDescription(pc.localDescription);
  }

  /** Take a friend's invite code and return the answer code to send back. */
  async acceptOffer(code, name) {
    if (typeof RTCPeerConnection !== 'function') {
      this._status('error', 'This browser does not support peer-to-peer connections.');
      throw new Error('WebRTC unavailable');
    }
    this._reset();
    this.mode = 'p2p';
    this.isHost = false;
    this.name = String(name || this.name).slice(0, 16) || 'Player';
    this.since = Date.now();

    const offer = decodeDescription(code);
    const pc = this._newPeerConnection();
    this.pc = pc;
    pc.ondatachannel = (event) => this._wireChannel(event.channel);
    await pc.setRemoteDescription(offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await waitForIce(pc);
    this._status('waiting', 'Answer ready — send it back to the host and keep this tab open.');
    return encodeDescription(pc.localDescription);
  }

  /** Host: apply the answer code from the guest. */
  async acceptAnswer(code) {
    if (!this.pc) throw new Error('Create an invite first.');
    await this.pc.setRemoteDescription(decodeDescription(code));
    this._status('connecting', 'Connecting…');
  }

  sendChat(text) {
    const body = { t: 'chat', text: String(text || '').slice(0, 200) };
    if (!this.connected) return;
    if (this.mode === 'local') this._post(body);
    else this._send(body);
  }

  sendBlockEntity(payload) {
    if (!this.connected) return;
    const body = { t: 'be', ...payload };
    if (this.mode === 'local') this._post(body);
    else this._send(body);
  }

  sendState(state) {
    if (!this.connected) return;
    if (this.mode === 'local') this._post({ t: 'state', ...state });
    else this._send({ t: 'state', ...state });
  }

  sendEdit(edit) {
    if (!this.connected) return;
    if (this.mode === 'local') this._post({ t: 'edit', ...edit });
    else this._send({ t: 'edit', ...edit });
  }

  sendTime(value) {
    if (!this.connected) return;
    if (this.mode === 'local') this._post({ t: 'time', time: value });
    else this._send({ t: 'time', time: value });
  }

  leave(notify = true) {
    if (this.closed) return;
    this.closed = true;
    if (notify) {
      if (this.mode === 'local' && this.channel) this._post({ t: 'bye' });
      else if (this.dc && this.dc.readyState === 'open') this._send({ t: 'bye' });
    }
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    if (this.channel) {
      this.channel.onmessage = null;
      this.channel.close();
      this.channel = null;
    }
    if (this.discovery) {
      this.discovery.onmessage = null;
      this.discovery.close();
      this.discovery = null;
    }
    if (this.dc) {
      this.dc.onclose = null;
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    window.removeEventListener('pagehide', this._onPageHide);
    this.peers.clear();
    this.handlers.onPeers?.([]);
    this._status('idle', 'Not connected');
  }

  /* ------------------------------------------------------------------ */
  /* BroadcastChannel plumbing                                           */
  /* ------------------------------------------------------------------ */

  _post(message) {
    if (!this.channel) return;
    this.channel.postMessage({ ...message, from: this.selfId, name: this.name, since: this.since });
  }

  _receive(data) {
    if (!data || typeof data !== 'object' || !data.from || data.from === this.selfId) return;
    this._handle(data, data.from);
  }

  _authorityId() {
    let bestId = this.selfId;
    let bestSince = this.since;
    for (const peer of this.peers.values()) {
      if (peer.since < bestSince || (peer.since === bestSince && peer.id < bestId)) {
        bestId = peer.id;
        bestSince = peer.since;
      }
    }
    return bestId;
  }

  _prunePeers() {
    const now = Date.now();
    for (const peer of [...this.peers.values()]) {
      if (now - peer.lastSeen > PEER_TIMEOUT) this._dropPeer(peer.id, 'timed out');
    }
  }

  _dropPeer(id, reason) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    this.handlers.onPeerLeave?.(peer, reason);
    this.handlers.onPeers?.(this._peerList());
    this._status(this.statusState, this.statusText);
  }

  /* ------------------------------------------------------------------ */
  /* Message handling                                                    */
  /* ------------------------------------------------------------------ */

  _handle(message, from) {
    if (!message || typeof message !== 'object') return;
    if (message.t !== 'bye') {
      // Every message carries who sent it, so it doubles as presence.
      this._touchPeer(from, message.name, message.since);
    }
    switch (message.t) {
      case 'join':
        // A newcomer is asking for the world; only the earliest peer answers.
        this._touchPeer(from, message.name, message.since);
        this._maybeSendWorld(from);
        break;
      case 'hello':
        break;
      case 'world':
        if (message.to && message.to !== this.selfId) return;
        if (this.worldSynced) return;
        this.worldSynced = true;
        this.handlers.onWorld?.(message.snapshot, from);
        break;
      case 'state':
        this.handlers.onState?.(from, message);
        break;
      case 'edit':
        this.handlers.onEdit?.(message, from);
        break;
      case 'time':
        this.handlers.onTime?.(Number(message.time), from);
        break;
      case 'chat':
        this.handlers.onChat?.(String(message.name || 'Player').slice(0, 16), String(message.text || '').slice(0, 200), from);
        break;
      case 'be':
        this.handlers.onBlockEntity?.(message, from);
        break;
      case 'bye':
        this._dropPeer(from, 'left');
        break;
      default:
        break;
    }
  }

  _touchPeer(id, name, since) {
    const now = Date.now();
    let peer = this.peers.get(id);
    if (!peer) {
      peer = {
        id,
        name: String(name || 'Player').slice(0, 16),
        since: Number(since) || now,
        lastSeen: now,
      };
      this.peers.set(id, peer);
      this.handlers.onPeerJoin?.(peer);
      this.handlers.onPeers?.(this._peerList());
      if (this.mode === 'local' && !this.worldSynced) this._maybeSendWorld(id);
      return;
    }
    peer.lastSeen = now;
    if (name && name !== peer.name) {
      peer.name = String(name).slice(0, 16);
      this.handlers.onPeerName?.(peer);
      this.handlers.onPeers?.(this._peerList());
    }
  }

  _peerList() {
    return [...this.peers.values()].map((peer) => ({ id: peer.id, name: peer.name }));
  }

  _maybeSendWorld(peerId) {
    const snapshot = this.handlers.getWorldSnapshot?.();
    if (!snapshot) return;
    // In local rooms the peer that has been around longest owns the world.
    if (this.mode === 'local' && this._authorityId() !== this.selfId) return;
    const message = { t: 'world', to: peerId, snapshot };
    if (this.mode === 'local') this._post(message);
    else this._send(message);
  }

  /* ------------------------------------------------------------------ */
  /* WebRTC plumbing                                                     */
  /* ------------------------------------------------------------------ */

  _newPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        this._handleDisconnect();
      }
    };
    return pc;
  }

  _openDiscovery() {
    if (this.discovery) return;
    try {
      this.discovery = new BroadcastChannel(DISCOVERY_CHANNEL);
      this.discovery.onmessage = (event) => {
        const message = event.data;
        if (!message || message.t !== 'discover') return;
        if (!this.room) return;
        this.discovery.postMessage({
          t: 'server-info',
          room: this.room,
          players: this.playerCount,
          host: this.name,
          mode: this.mode,
        });
      };
    } catch {
      this.discovery = null;
    }
  }

  _wireChannel(dc) {
    this.dc = dc;
    dc.onopen = () => {
      const peerId = this.isHost ? 'guest' : 'host';
      const peer = { id: peerId, name: 'Friend', since: 0, lastSeen: Date.now() };
      this.peers.set(peerId, peer);
      this._status('connected', this.isHost ? 'Connected — your friend can join in.' : 'Connected to the host.');
      this.handlers.onPeerJoin?.(peer);
      this.handlers.onPeers?.(this._peerList());
      this._send({ t: 'hello' });
      if (this.isHost) this._maybeSendWorld(peerId);
      else this._send({ t: 'join' });
    };
    dc.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      // A direct connection has exactly one remote peer, so use a stable id
      // instead of the random session id inside each message.
      this._handle(message, this.isHost ? 'guest' : 'host');
    };
    dc.onclose = () => {
      this._handleDisconnect();
    };
  }

  _handleDisconnect() {
    if (this.closed) return;
    for (const id of [...this.peers.keys()]) this._dropPeer(id, 'disconnected');
    this._status('error', 'Your friend disconnected.');
    this.handlers.onDisconnect?.();
  }

  _send(message) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify({ ...message, from: this.selfId, name: this.name, since: this.since }));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  _status(state, text) {
    this.statusState = state;
    this.statusText = text;
    this.handlers.onStatus?.({ state, text });
  }

  _reset() {
    this.closed = false;
    this.worldSynced = false;
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    if (this.channel) {
      this.channel.onmessage = null;
      this.channel.close();
      this.channel = null;
    }
    if (this.discovery) {
      this.discovery.onmessage = null;
      this.discovery.close();
      this.discovery = null;
    }
    if (this.dc) {
      this.dc.onclose = null;
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.peers.clear();
  }
}


/**
 * Look for rooms open in other tabs of this browser. Sessions answer on a
 * dedicated discovery channel while they are in a room.
 */
export function discoverServers(timeout = 900) {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel !== 'function') {
      resolve([]);
      return;
    }
    const found = new Map();
    let channel;
    try {
      channel = new BroadcastChannel(DISCOVERY_CHANNEL);
    } catch {
      resolve([]);
      return;
    }
    channel.onmessage = (event) => {
      const message = event.data;
      if (!message || message.t !== 'server-info' || !message.room) return;
      found.set(message.room, {
        room: message.room,
        players: Number(message.players) || 1,
        host: String(message.host || 'Player').slice(0, 16),
      });
    };
    channel.postMessage({ t: 'discover', from: Math.random().toString(36).slice(2) });
    setTimeout(() => {
      channel.close();
      resolve([...found.values()]);
    }, timeout);
  });
}
