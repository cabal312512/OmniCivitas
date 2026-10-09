#include "aaa.hpp"
#include "config/8/RenderPolicy.hpp"
#include <algorithm>
#include <cmath>
#include <complex>
#include <limits>
#include <stdexcept>

namespace media13 {
Processed process(std::vector<double> samples, const Plan& plan) {
    if (plan.lowpassHz > 0) {
        const double alpha = -std::expm1(-stock8::Common::tau * plan.lowpassHz / plan.sampleRate);
        double previous = 0;
        for (double& value : samples) {
            previous += alpha * (value - previous);
            value = previous;
        }
    }
    for (double& value : samples) value *= plan.gain;
    if (plan.echo.mix > 0) {
        const auto dry = samples;
        const auto delay = static_cast<std::size_t>(std::llround(plan.echo.delayMs * plan.sampleRate / 1000.0));
        double coefficient = plan.echo.mix;
        for (int tap = 1; tap <= plan.echo.repeats; ++tap) {
            const auto offset = delay * static_cast<std::size_t>(tap);
            if (offset >= samples.size()) break;
            for (std::size_t index = offset; index < samples.size(); ++index)
                samples[index] += dry[index - offset] * coefficient;
            coefficient *= plan.echo.feedback;
        }
    }
    Processed result;
    double peak = 0;
    for (double value : samples) {
        if (!std::isfinite(value)) throw std::runtime_error("non-finite DSP result");
        peak = std::max(peak, std::abs(value));
    }
    if (plan.normalize && peak > std::numeric_limits<double>::epsilon())
        result.normalizationGain = stock8::Common::normalizedPeak / peak;
    result.pcm.reserve(samples.size());
    for (double value : samples) {
        value *= result.normalizationGain;
        if (std::abs(value) > 1.0) ++result.clippedSamples;
        result.pcm.push_back(static_cast<std::int16_t>(std::llround(std::clamp(value, -1.0, 1.0) * 32767.0)));
    }
    return result;
}

namespace {
void transform(std::vector<std::complex<double>>& values) {
    const std::size_t count = values.size();
    for (std::size_t i = 1, j = 0; i < count; ++i) {
        std::size_t bit = count >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(values[i], values[j]);
    }
    for (std::size_t length = 2; length <= count; length <<= 1) {
        const auto angle = -stock8::Common::tau / static_cast<double>(length);
        const std::complex<double> step(std::cos(angle), std::sin(angle));
        for (std::size_t offset = 0; offset < count; offset += length) {
            std::complex<double> phase(1, 0);
            for (std::size_t j = 0; j < length / 2; ++j) {
                const auto even = values[offset + j];
                const auto odd = values[offset + j + length / 2] * phase;
                values[offset + j] = even + odd;
                values[offset + j + length / 2] = even - odd;
                phase *= step;
            }
        }
    }
}
}

Json analyze(const Processed& audio, const Plan& plan) {
    const auto& pcm = audio.pcm;
    double square = 0, peak = 0;
    std::size_t zeroCrossings = 0;
    for (std::size_t i = 0; i < pcm.size(); ++i) {
        const double value = pcm[i] / 32768.0;
        square += value * value;
        peak = std::max(peak, std::abs(value));
        if (i > 0 && ((pcm[i - 1] < 0 && pcm[i] >= 0) || (pcm[i - 1] >= 0 && pcm[i] < 0))) ++zeroCrossings;
    }
    Json waveform = Json::array();
    const std::size_t bins = std::min(stock8::Common::waveformBins, pcm.size());
    for (std::size_t bin = 0; bin < bins; ++bin) {
        const auto first = bin * pcm.size() / bins;
        const auto last = (bin + 1) * pcm.size() / bins;
        const auto limits = std::minmax_element(pcm.begin() + first, pcm.begin() + last);
        waveform.push_back({{"t", 1000.0 * (first + last) / (2.0 * plan.sampleRate)},
            {"min", *limits.first / 32768.0}, {"max", *limits.second / 32768.0}});
    }
    std::size_t fftSize = 1;
    while (fftSize * 2 <= std::min(stock8::Common::fftFrames, pcm.size())) fftSize *= 2;
    std::size_t fftStart = 0;
    double bestEnergy = -1;
    const auto stride = std::max<std::size_t>(1, fftSize / 2);
    const auto finalWindow = pcm.size() - fftSize;
    for (std::size_t start = 0;;) {
        double energy = 0;
        for (std::size_t i = start; i < start + fftSize; ++i) {
            const double value = pcm[i] / 32768.0;
            energy += value * value;
        }
        if (energy > bestEnergy) { bestEnergy = energy; fftStart = start; }
        if (start == finalWindow) break;
        start = std::min(start + stride, finalWindow);
    }
    std::vector<std::complex<double>> frequencies(fftSize);
    double windowSum = 0;
    for (std::size_t i = 0; i < fftSize; ++i) {
        const double window = fftSize > 1 ? 0.5 - 0.5 * std::cos(stock8::Common::tau * i / (fftSize - 1)) : 1;
        windowSum += window;
        frequencies[i] = (pcm[fftStart + i] / 32768.0) * window;
    }
    transform(frequencies);
    Json spectrum = Json::array();
    const auto half = fftSize / 2;
    const auto spectrumCount = std::min(stock8::Common::spectrumBins, half + 1);
    double dominantHz = 0, dominantAmplitude = 0;
    for (std::size_t bin = 0; bin < spectrumCount; ++bin) {
        const auto first = bin * (half + 1) / spectrumCount;
        const auto last = (bin + 1) * (half + 1) / spectrumCount;
        std::size_t selected = first;
        double amplitude = 0;
        for (std::size_t i = first; i < last; ++i) {
            const double value = std::abs(frequencies[i]) * (i == 0 || i == half ? 1 : 2) / windowSum;
            if (value > amplitude) { amplitude = value; selected = i; }
            if (i > 0 && value > dominantAmplitude) {
                dominantAmplitude = value;
                dominantHz = static_cast<double>(i) * plan.sampleRate / fftSize;
            }
        }
        spectrum.push_back({{"hz", static_cast<double>(selected) * plan.sampleRate / fftSize}, {"amplitude", amplitude}});
    }
    Json notes = Json::array();
    for (const auto& line : plan.lines) {
        notes.push_back({{"n", line.price}, {"t", line.due}, {"d", line.term}, {"v", line.paid},
            {"hz", invoice::BalanceSheet::frequency(line.price)}, {"sourceIndex", line.ordinal}});
    }
    return {{"sampleRate", plan.sampleRate}, {"samples", pcm.size()}, {"channels", 1}, {"bitsPerSample", 16},
        {"durationMs", pcm.size() * 1000.0 / plan.sampleRate}, {"rms", std::sqrt(square / pcm.size())},
        {"peak", peak}, {"zeroCrossings", zeroCrossings}, {"clippedSamples", audio.clippedSamples},
        {"normalizationGain", audio.normalizationGain}, {"dominantHz", dominantHz},
        {"spectrumWindowStartMs", fftStart * 1000.0 / plan.sampleRate}, {"spectrumWindowFrames", fftSize},
        {"spectrumMethod", "Hann FFT; maximum-energy window; grouped peak bins"},
        {"waveformMethod", "PCM minimum/maximum envelopes; not resampled audio"},
        {"spectrum", spectrum}, {"waveform", waveform}, {"notes", notes}};
}
}
