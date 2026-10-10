const DEFAULT_TRACK = "/planetarium/audio/lost_in_the_snow_wave.ogg";

/** A single loop with browser autoplay recovery and page-lifecycle cleanup. */
export class PlanetariumMusic {
  constructor({ src = DEFAULT_TRACK, volume = 0.32, onChange } = {}) {
    this.audio = new Audio(src);
    this.audio.loop = true;
    this.audio.preload = "none";
    this.audio.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    this.audio.setAttribute("playsinline", "");
    this.onChange = typeof onChange === "function" ? onChange : () => {};
    this.state = {
      muted: false,
      volume: this.audio.volume,
      playing: false,
      blocked: false,
      error: null,
    };
    this.wanted = false;
    this.pageActive = true;
    this.disposed = false;
    this.pending = null;
    this.resumePending = false;
    this.unlockAttached = false;

    this.onGesture = (event) => {
      if (!event.isTrusted) return;
      if (
        event.type === "keydown" &&
        ["Alt", "Control", "Meta", "Shift", "Escape"].includes(event.key)
      )
        return;
      void this.attempt();
    };
    this.onPlaying = () => {
      if (!this.canPlay()) {
        this.audio.pause();
        return;
      }
      this.detachUnlock();
      this.update({ playing: true, blocked: false, error: null });
    };
    this.onPause = () => this.update({ playing: false });
    this.onError = () => {
      this.detachUnlock();
      this.update({
        playing: false,
        blocked: false,
        error: this.audio.error?.code || "media",
      });
    };
    this.onPageHide = (event) => {
      if (!event.persisted) {
        this.dispose();
        return;
      }
      this.pageActive = false;
      this.detachUnlock();
      this.audio.pause();
    };
    this.onPageShow = (event) => {
      if (!event.persisted || this.disposed) return;
      this.pageActive = true;
      if (this.canPlay()) {
        if (this.pending && this.audio.paused) this.resumePending = true;
        void this.attempt();
      }
    };

    this.audio.addEventListener("playing", this.onPlaying);
    this.audio.addEventListener("pause", this.onPause);
    this.audio.addEventListener("error", this.onError);
    window.addEventListener("pagehide", this.onPageHide);
    window.addEventListener("pageshow", this.onPageShow);
  }

  getState() {
    return { ...this.state };
  }

  update(change) {
    if (this.disposed) return;
    const changed = Object.entries(change).some(
      ([key, value]) => this.state[key] !== value,
    );
    Object.assign(this.state, change);
    if (changed) this.onChange(this.getState());
  }

  canPlay() {
    return (
      !this.disposed &&
      this.pageActive &&
      this.wanted &&
      !this.state.muted &&
      this.state.volume > 0
    );
  }

  attachUnlock() {
    if (this.unlockAttached || this.disposed) return;
    this.unlockAttached = true;
    document.addEventListener("pointerdown", this.onGesture, true);
    document.addEventListener("keydown", this.onGesture, true);
  }

  detachUnlock() {
    if (!this.unlockAttached) return;
    this.unlockAttached = false;
    document.removeEventListener("pointerdown", this.onGesture, true);
    document.removeEventListener("keydown", this.onGesture, true);
  }

  playbackFailure(error) {
    if (!this.canPlay()) return false;
    if (error?.name === "NotAllowedError") {
      this.attachUnlock();
      this.update({ playing: false, blocked: true, error: null });
    } else if (error?.name !== "AbortError") {
      this.detachUnlock();
      this.update({
        playing: false,
        blocked: false,
        error: error?.name || "media",
      });
    }
    return false;
  }

  attempt() {
    if (!this.canPlay()) return Promise.resolve(false);
    if (this.pending) return this.pending;
    let playback;
    try {
      // Calling play within the original gesture retains its browser activation.
      playback = this.audio.play();
    } catch (error) {
      return Promise.resolve(this.playbackFailure(error));
    }
    const pending = Promise.resolve(playback).then(
      () => {
        if (!this.canPlay()) {
          this.audio.pause();
          return false;
        }
        this.detachUnlock();
        this.update({ playing: true, blocked: false, error: null });
        return true;
      },
      (error) => this.playbackFailure(error),
    );
    this.pending = pending.finally(() => {
      this.pending = null;
      // A quick mute/unmute can abort an in-flight play promise. Retry once
      // after that promise settles rather than losing the unmute request.
      const resume = this.resumePending;
      this.resumePending = false;
      if (resume && this.canPlay() && this.audio.paused) void this.attempt();
    });
    return this.pending;
  }

  start() {
    if (this.disposed) return Promise.resolve(false);
    this.wanted = true;
    return this.attempt();
  }

  setMuted(muted) {
    if (this.disposed) return Promise.resolve(false);
    const next = Boolean(muted);
    this.audio.muted = next;
    this.update({ muted: next, ...(next ? { blocked: false } : {}) });
    if (next) {
      this.detachUnlock();
      this.audio.pause();
      return Promise.resolve(false);
    }
    if (this.pending && this.audio.paused) this.resumePending = true;
    return this.attempt();
  }

  toggleMuted() {
    return this.setMuted(!this.state.muted);
  }

  setVolume(volume) {
    if (this.disposed) return Promise.resolve(false);
    const next = Math.max(0, Math.min(1, Number(volume) || 0));
    this.audio.volume = next;
    this.update({ volume: next });
    if (next === 0) {
      this.update({ blocked: false });
      this.detachUnlock();
      this.audio.pause();
      return Promise.resolve(false);
    }
    if (this.pending && this.audio.paused) this.resumePending = true;
    return this.attempt();
  }

  dispose() {
    if (this.disposed) return;
    this.detachUnlock();
    this.audio.removeEventListener("playing", this.onPlaying);
    this.audio.removeEventListener("pause", this.onPause);
    this.audio.removeEventListener("error", this.onError);
    window.removeEventListener("pagehide", this.onPageHide);
    window.removeEventListener("pageshow", this.onPageShow);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.state.playing = false;
    this.disposed = true;
    this.wanted = false;
  }
}
