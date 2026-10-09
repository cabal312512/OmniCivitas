#include "aaa.hpp"
#include "config/8/RenderPolicy.hpp"
#include <algorithm>
#include <cmath>
#include <initializer_list>
#include <stdexcept>
#include <string_view>

namespace media13 {
namespace {
void fields(const Json& object, std::initializer_list<std::string_view> allowed, const char* name) {
    if (!object.is_object()) throw std::invalid_argument(std::string(name) + " must be an object");
    for (const auto& entry : object.items()) {
        if (std::find(allowed.begin(), allowed.end(), entry.key()) == allowed.end())
            throw std::invalid_argument(std::string(name) + " contains an unsupported field");
    }
}
double number(const Json& object, const char* key, double fallback, double minimum, double maximum) {
    const auto it = object.find(key);
    if (it == object.end()) return fallback;
    if (!it->is_number()) throw std::invalid_argument(std::string(key) + " must be numeric");
    const double value = it->get<double>();
    if (!std::isfinite(value) || value < minimum || value > maximum)
        throw std::invalid_argument(std::string(key) + " is outside its supported range");
    return value;
}
int integer(const Json& object, const char* key, int fallback, int minimum, int maximum) {
    const double value = number(object, key, fallback, minimum, maximum);
    if (std::floor(value) != value) throw std::invalid_argument(std::string(key) + " must be an integer");
    return static_cast<int>(value);
}
bool boolean(const Json& object, const char* key, bool fallback) {
    const auto it = object.find(key);
    if (it == object.end()) return fallback;
    if (!it->is_boolean()) throw std::invalid_argument(std::string(key) + " must be boolean");
    return it->get<bool>();
}
}

Plan readPlan(const Json& input) {
    fields(input, {"schemaVersion", "events", "tempo", "sampleRate", "preset", "gain",
        "lowpassHz", "echo", "normalize", "includeMidi", "durationMs"}, "render request");
    if (integer(input, "schemaVersion", 1, 1, 1) != 1) throw std::invalid_argument("unsupported schema");
    Plan result;
    result.sampleRate = integer(input, "sampleRate", 16000, 8000, 44100);
    if (!stock8::Common::sampleRate(result.sampleRate)) throw std::invalid_argument("unsupported sampleRate");
    result.tempo = number(input, "tempo", 120, 30, 300);
    result.gain = number(input, "gain", 0.8, 0, 2);
    result.lowpassHz = number(input, "lowpassHz", 0, 0, result.sampleRate * 0.45);
    if (result.lowpassHz > 0 && result.lowpassHz < 20) throw std::invalid_argument("lowpassHz must be zero or at least 20");
    result.normalize = boolean(input, "normalize", false);
    result.includeMidi = boolean(input, "includeMidi", true);
    if (input.contains("preset")) {
        if (!input["preset"].is_string()) throw std::invalid_argument("preset must be text");
        result.preset = input["preset"].get<std::string>();
    }
    if (result.preset != "sine" && result.preset != "triangle" && result.preset != "bell")
        throw std::invalid_argument("unsupported preset");
    if (input.contains("echo")) {
        const auto& echo = input["echo"];
        fields(echo, {"delayMs", "feedback", "mix", "repeats"}, "echo");
        result.echo.delayMs = number(echo, "delayMs", 180, 10, 1500);
        result.echo.feedback = number(echo, "feedback", 0.25, 0, 0.7);
        result.echo.mix = number(echo, "mix", 0, 0, 0.8);
        result.echo.repeats = integer(echo, "repeats", 3, 1, 4);
    }
    const auto events = input.find("events");
    if (events == input.end() || !events->is_array() || events->empty() || events->size() > stock8::Common::notes)
        throw std::invalid_argument("events must contain 1 to 256 notes");
    std::vector<invoice::StockRow> rows;
    rows.reserve(events->size());
    double end = 0;
    std::size_t neededFrames = 0;
    std::uint64_t voiceFrames = 0;
    for (std::size_t i = 0; i < events->size(); ++i) {
        const auto& event = (*events)[i];
        fields(event, {"n", "t", "d", "v"}, "note");
        if (!event.contains("n") || !event.contains("t") || !event.contains("d"))
            throw std::invalid_argument("each note requires n, t and d");
        const int note = integer(event, "n", 60, 0, 127);
        const double start = number(event, "t", 0, 0, stock8::Common::durationMs);
        const double duration = number(event, "d", 500, 10, stock8::Common::durationMs);
        const double velocity = number(event, "v", 0.7, 0, 1);
        if (start + duration > stock8::Common::durationMs) throw std::invalid_argument("note end exceeds 20 seconds");
        if (invoice::BalanceSheet::frequency(note) >= result.sampleRate * 0.45)
            throw std::invalid_argument("note frequency exceeds this sampleRate's synthesis band");
        voiceFrames += static_cast<std::uint64_t>(std::ceil(duration * result.sampleRate / 1000.0));
        if (voiceFrames > stock8::Common::voiceFrames) throw std::invalid_argument("aggregate voice-frame budget exceeded");
        end = std::max(end, start + duration);
        neededFrames = std::max(neededFrames, static_cast<std::size_t>(std::llround((start + duration) * result.sampleRate / 1000.0)));
        rows.push_back({velocity, static_cast<double>(note), duration, start, static_cast<double>(i)});
    }
    // One bounded sort on the legacy positional rows, then a canonical object sort.
    std::stable_sort(rows.begin(), rows.end(), [](const auto& a, const auto& b) { return a[3] < b[3]; });
    result.lines = invoice::BalanceSheet::restore(rows);
    const double tail = result.echo.mix > 0 ? result.echo.delayMs * result.echo.repeats : 0;
    end += tail;
    if (end > stock8::Common::durationMs) throw std::invalid_argument("echo tail exceeds 20 seconds");
    if (result.echo.mix > 0) {
        const auto delayFrames = static_cast<std::size_t>(std::llround(result.echo.delayMs * result.sampleRate / 1000.0));
        neededFrames += delayFrames * static_cast<std::size_t>(result.echo.repeats);
    }
    const auto maximumFrames = static_cast<std::size_t>(result.sampleRate) * 20;
    if (neededFrames > maximumFrames) throw std::invalid_argument("quantized echo tail exceeds 20 seconds");
    const double minimumMs = std::max(end, neededFrames * 1000.0 / result.sampleRate);
    const double requestedMs = number(input, "durationMs", minimumMs, minimumMs, stock8::Common::durationMs);
    result.frames = std::max(neededFrames, static_cast<std::size_t>(std::ceil(requestedMs * result.sampleRate / 1000.0)));
    if (result.frames > maximumFrames) throw std::invalid_argument("quantized output duration exceeds 20 seconds");
    result.durationMs = result.frames * 1000.0 / result.sampleRate;
    return result;
}
}
