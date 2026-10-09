#include "services/site-audio/cpp/aaa.hpp"
#include <cmath>
#include <iostream>
#include <stdexcept>

using media13::Json;
namespace {
std::size_t checks = 0;
void require(bool predicate, const char* name) {
    ++checks;
    if (!predicate) throw std::runtime_error(name);
}
bool rejects(const Json& input) {
    try { media13::readPlan(input); return false; }
    catch (const std::exception&) { return true; }
}
Json base() {
    return {{"events", {{{"n", 69}, {"t", 0}, {"d", 1000}, {"v", 1}}}},
        {"sampleRate", 16000}, {"gain", 0.5}, {"preset", "sine"}, {"includeMidi", true}};
}
}
int main() {
    try {
        auto input = base();
        const auto dry = media13::assemble(media13::readPlan(input));
        const double rms = dry["analysis"]["rms"], peak = dry["analysis"]["peak"];
        require(dry["analysis"]["samples"] == 16000, "real timeline frame count");
        require(rms > 0.33 && rms < 0.36 && peak > 0.49 && peak < 0.501, "440 Hz sine RMS/peak");
        require(std::abs(dry["analysis"]["dominantHz"].get<double>() - 440) < 5, "FFT detects actual 440 Hz oscillator");
        require(dry["wavBytes"] == 32044, "PCM16 mono real byte count");
        input = base(); input["events"][0]["t"] = 990; input["events"][0]["d"] = 10;
        const auto late = media13::assemble(media13::readPlan(input));
        require(late["analysis"]["rms"].get<double>() > 0 && late["analysis"]["dominantHz"].get<double>() > 0,
            "spectrum includes the final non-aligned window and its late note");
        input = base();
        input["tempo"] = 60;
        const auto slow = media13::assemble(media13::readPlan(input));
        input["tempo"] = 240;
        const auto fast = media13::assemble(media13::readPlan(input));
        require(slow["audio"] == fast["audio"] && slow["midi"] != fast["midi"], "tempo cannot stretch millisecond audio events");
        input = base(); input["lowpassHz"] = 100;
        const auto filtered = media13::assemble(media13::readPlan(input));
        require(filtered["analysis"]["rms"].get<double>() < rms * 0.3, "lowpass attenuates a higher-frequency real signal");
        input = base(); input["events"][0]["d"] = 100; input["echo"] = {{"delayMs", 200}, {"feedback", 0.3}, {"mix", 0.5}, {"repeats", 2}};
        input["normalize"] = true;
        const auto echo = media13::assemble(media13::readPlan(input));
        require(echo["analysis"]["samples"] == 8000, "finite echo tail participates in frame count");
        require(std::abs(echo["analysis"]["peak"].get<double>() - 0.95) < 0.0001, "normalization controls actual PCM peak");
        const auto envelope = echo["analysis"]["waveform"];
        double tail = 0;
        for (const auto& point : envelope) if (point["t"].get<double>() > 400)
            tail = std::max(tail, std::abs(point["max"].get<double>()));
        require(tail > 0.01, "second echo tap contains real nonzero samples");
        input = base(); input["sampleRate"] = 8000; input["events"][0]["d"] = 10;
        input["echo"] = {{"delayMs", 10.0625}, {"feedback", 0.7}, {"mix", 0.8}, {"repeats", 4}};
        const auto quantized = media13::assemble(media13::readPlan(input));
        require(quantized["analysis"]["samples"] == 404, "quantized echo endpoints cannot truncate their final samples");
        input = base(); input["events"][0]["v"] = 0; input["normalize"] = true;
        const auto silence = media13::assemble(media13::readPlan(input));
        require(silence["analysis"]["rms"] == 0 && silence["analysis"]["peak"] == 0, "zero-velocity normalization remains finite silence");
        input = base(); input["preset"] = "triangle";
        const auto triangle = media13::assemble(media13::readPlan(input));
        input["preset"] = "bell";
        const auto bell = media13::assemble(media13::readPlan(input));
        require(triangle["audio"] != dry["audio"] && bell["audio"] != triangle["audio"], "three presets produce different actual PCM");
        input = base(); input["gain"] = 2; input["events"].push_back(input["events"][0]);
        const auto clipped = media13::assemble(media13::readPlan(input));
        require(clipped["analysis"]["clippedSamples"].get<std::size_t>() > 0 && clipped["analysis"]["peak"].get<double>() < 1.0, "clipping is counted and bounded");
        input = base(); input["path"] = "anything"; require(rejects(input), "paths are rejected");
        input = base(); input["events"][0]["n"] = 69.5; require(rejects(input), "fractional MIDI notes are rejected");
        input = base(); input["sampleRate"] = 48000; require(rejects(input), "unsupported sample rate is rejected");
        input = base(); input["events"][0]["d"] = 20000; input["echo"] = {{"mix", 0.1}};
        require(rejects(input), "echo cannot silently truncate beyond duration policy");
        input = base(); for (int i = 0; i < 256; ++i) input["events"].push_back(input["events"][0]);
        require(rejects(input), "note count is bounded");
        input = base(); input["events"][0]["d"] = 20000;
        for (int i = 0; i < 30; ++i) input["events"].push_back(input["events"][0]);
        require(rejects(input), "aggregate synthesis work is bounded independently of output duration");
        std::cout << Json({{"ok", true}, {"checks", checks}, {"suite", "WEB1 C++ DSP/timeline"}}).dump() << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << Json({{"ok", false}, {"checks", checks}, {"error", error.what()}}).dump() << '\n';
        return 1;
    }
}
