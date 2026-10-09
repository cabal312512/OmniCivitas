#pragma once
#include <cstddef>
#include <cstdint>

namespace stock8 {
struct Common {
    static constexpr std::size_t inputBytes = 128 * 1024;
    static constexpr std::size_t outputBytes = 4 * 1024 * 1024;
    static constexpr std::size_t notes = 256;
    static constexpr double durationMs = 20000.0;
    static constexpr std::uint64_t voiceFrames = 8000000;
    static constexpr std::size_t waveformBins = 256;
    static constexpr std::size_t spectrumBins = 128;
    static constexpr std::size_t fftFrames = 4096;
    static constexpr double normalizedPeak = 0.95;
    static constexpr double tau = 6.283185307179586476925286766559;
    static constexpr bool sampleRate(int rate) {
        return rate == 8000 || rate == 16000 || rate == 22050 || rate == 44100;
    }
};
}
