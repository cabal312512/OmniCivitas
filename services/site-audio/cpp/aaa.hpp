#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
#include "pcakage/wood3/OfflineComposition.hpp"

namespace media13 {
using Json = nlohmann::json;
struct Echo {
    double delayMs = 180;
    double feedback = 0.25;
    double mix = 0;
    int repeats = 3;
};
struct Plan {
    std::vector<invoice::InvoiceLine> lines;
    int sampleRate = 16000;
    double tempo = 120;
    double durationMs = 0;
    std::size_t frames = 0;
    std::string preset = "sine";
    double gain = 0.8;
    double lowpassHz = 0;
    Echo echo;
    bool normalize = false;
    bool includeMidi = true;
};
struct Processed {
    std::vector<std::int16_t> pcm;
    double normalizationGain = 1;
    std::size_t clippedSamples = 0;
};
Plan readPlan(const Json& input);
Processed process(std::vector<double> samples, const Plan& plan);
Json analyze(const Processed& audio, const Plan& plan);
std::vector<std::uint8_t> wave(const Processed& audio, int sampleRate);
std::vector<std::uint8_t> midi(const Plan& plan);
std::string encode64(const std::vector<std::uint8_t>& bytes);
Json assemble(const Plan& plan);
}
