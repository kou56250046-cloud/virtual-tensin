'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CALL_CHANNEL = 'webrtc-audio-call';

export interface CallParticipant {
  sessionId: string;
  userName: string;
  isMuted: boolean;
  isLocal: boolean;
}

interface PeerState {
  pc: RTCPeerConnection;
  name: string;
  iceCandidateQueue: RTCIceCandidateInit[];
  remoteDescSet: boolean;
  remoteMuted: boolean;
}

interface UseWebRTCCallReturn {
  isInCall: boolean;
  isMuted: boolean;
  participants: CallParticipant[];
  joinCall: () => Promise<void>;
  leaveCall: () => void;
  toggleMute: () => void;
  error: string | null;
}

export function useWebRTCCall(mySessionId: string, myName: string): UseWebRTCCallReturn {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);

  // すべての可変状態は ref で管理（Realtime コールバック内でのstale closure防止）
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerMapRef = useRef<Map<string, PeerState>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const isInCallRef = useRef(false);
  const isMutedRef = useRef(false);
  // 常に最新の値を参照できるよう同期
  const mySessionIdRef = useRef(mySessionId);
  const myNameRef = useRef(myName);
  mySessionIdRef.current = mySessionId;
  myNameRef.current = myName;

  // 参加者リストをReact stateに反映（refから呼び出し可能）
  const syncPartsRef = useRef<() => void>(() => {});
  syncPartsRef.current = () => {
    const list: CallParticipant[] = [];
    if (isInCallRef.current) {
      list.push({
        sessionId: mySessionIdRef.current,
        userName: myNameRef.current,
        isMuted: isMutedRef.current,
        isLocal: true,
      });
    }
    peerMapRef.current.forEach((state, sessionId) => {
      list.push({ sessionId, userName: state.name, isMuted: state.remoteMuted, isLocal: false });
    });
    setParticipants(list);
  };

  // Supabase Realtime シグナリングチャンネルをマウント時に1回設定
  useEffect(() => {
    const supabase = createClient();

    const makePeer = (remoteId: string, remoteName: string): RTCPeerConnection => {
      const existing = peerMapRef.current.get(remoteId);
      if (existing) return existing.pc;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerMapRef.current.set(remoteId, {
        pc, name: remoteName,
        iceCandidateQueue: [], remoteDescSet: false, remoteMuted: false,
      });

      // ローカルオーディオトラックを追加
      localStreamRef.current?.getTracks().forEach((t) =>
        pc.addTrack(t, localStreamRef.current!)
      );

      // リモートオーディオを再生
      pc.ontrack = (ev) => {
        const audio = new Audio();
        audio.srcObject = ev.streams[0];
        audio.autoplay = true;
        audio.play().catch(() => null);
      };

      // ICE候補を相手に送信
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        channelRef.current?.send({
          type: 'broadcast', event: 'call-ice',
          payload: { from: mySessionIdRef.current, to: remoteId, candidate: ev.candidate.toJSON() },
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peerMapRef.current.delete(remoteId);
          syncPartsRef.current();
        } else if (pc.connectionState === 'connected') {
          syncPartsRef.current();
        }
      };

      return pc;
    };

    const flushQueue = async (remoteId: string) => {
      const state = peerMapRef.current.get(remoteId);
      if (!state) return;
      for (const c of state.iceCandidateQueue) {
        await state.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => null);
      }
      state.iceCandidateQueue = [];
    };

    const channel = supabase
      .channel(CALL_CHANNEL)
      // 新規参加者 → 自分がOfferを送る
      .on('broadcast', { event: 'call-join' }, async ({ payload }) => {
        const { from, name } = payload as { from: string; name: string };
        if (from === mySessionIdRef.current || !isInCallRef.current) return;
        const pc = makePeer(from, name);
        syncPartsRef.current();
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast', event: 'call-offer',
            payload: { from: mySessionIdRef.current, fromName: myNameRef.current, to: from, sdp: offer },
          });
        } catch (err) {
          console.error('[WebRTC] offer error', err);
        }
      })
      // Offerを受け取る → Answerを返す
      .on('broadcast', { event: 'call-offer' }, async ({ payload }) => {
        const { from, fromName, to, sdp } = payload as {
          from: string; fromName?: string; to: string; sdp: RTCSessionDescriptionInit;
        };
        if (to !== mySessionIdRef.current || !isInCallRef.current) return;
        const pc = makePeer(from, fromName ?? '参加者');
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const state = peerMapRef.current.get(from);
          if (state) { state.remoteDescSet = true; await flushQueue(from); }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast', event: 'call-answer',
            payload: { from: mySessionIdRef.current, to: from, sdp: answer },
          });
          syncPartsRef.current();
        } catch (err) {
          console.error('[WebRTC] answer error', err);
        }
      })
      // Answerを受け取る
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        const { from, to, sdp } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit };
        if (to !== mySessionIdRef.current) return;
        const state = peerMapRef.current.get(from);
        if (!state) return;
        try {
          await state.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          state.remoteDescSet = true;
          await flushQueue(from);
        } catch (err) {
          console.error('[WebRTC] setRemoteDescription(answer) error', err);
        }
      })
      // ICE候補を受け取る
      .on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
        const { from, to, candidate } = payload as {
          from: string; to: string; candidate: RTCIceCandidateInit;
        };
        if (to !== mySessionIdRef.current) return;
        const state = peerMapRef.current.get(from);
        if (!state) return;
        if (state.remoteDescSet) {
          await state.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => null);
        } else {
          state.iceCandidateQueue.push(candidate);
        }
      })
      // 相手が退出
      .on('broadcast', { event: 'call-leave' }, ({ payload }) => {
        const { from } = payload as { from: string };
        const state = peerMapRef.current.get(from);
        if (state) { state.pc.close(); peerMapRef.current.delete(from); syncPartsRef.current(); }
      })
      // ミュート状態変化
      .on('broadcast', { event: 'call-mute' }, ({ payload }) => {
        const { from, muted } = payload as { from: string; muted: boolean };
        const state = peerMapRef.current.get(from);
        if (state) { state.remoteMuted = muted; syncPartsRef.current(); }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      peerMapRef.current.forEach((s) => s.pc.close());
      peerMapRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      isInCallRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // マウント時のみ

  const joinCall = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));

      localStreamRef.current = stream;
      isInCallRef.current = true;
      isMutedRef.current = false;
      setIsInCall(true);
      setIsMuted(false);
      syncPartsRef.current();

      // 他の参加者に自分が参加したことを通知
      channelRef.current?.send({
        type: 'broadcast', event: 'call-join',
        payload: { from: mySessionId, name: myName },
      });
    } catch {
      setError('マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。');
    }
  }, [mySessionId, myName]);

  const leaveCall = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast', event: 'call-leave',
      payload: { from: mySessionId },
    });
    peerMapRef.current.forEach((s) => s.pc.close());
    peerMapRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    isInCallRef.current = false;
    isMutedRef.current = false;
    setIsInCall(false);
    setIsMuted(false);
    setParticipants([]);
  }, [mySessionId]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isMutedRef.current;
    stream.getAudioTracks().forEach((t) => { t.enabled = !next; });
    isMutedRef.current = next;
    setIsMuted(next);
    syncPartsRef.current();
    channelRef.current?.send({
      type: 'broadcast', event: 'call-mute',
      payload: { from: mySessionId, muted: next },
    });
  }, [mySessionId]);

  return { isInCall, isMuted, participants, joinCall, leaveCall, toggleMute, error };
}
