#include "aaa.hpp"
#include "config/8/RenderPolicy.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace media13 {
namespace {
void text(std::vector<std::uint8_t>& bytes, const std::string& value) { bytes.insert(bytes.end(), value.begin(), value.end()); }
void little16(std::vector<std::uint8_t>& bytes, std::uint16_t value) {
    bytes.push_back(static_cast<std::uint8_t>(value)); bytes.push_back(static_cast<std::uint8_t>(value >> 8));
}
void little32(std::vector<std::uint8_t>& bytes, std::uint32_t value) {
    for (int i = 0; i < 4; ++i) bytes.push_back(static_cast<std::uint8_t>(value >> (8 * i)));
}
void big16(std::vector<std::uint8_t>& bytes, std::uint16_t value) {
    bytes.push_back(static_cast<std::uint8_t>(value >> 8)); bytes.push_back(static_cast<std::uint8_t>(value));
}
void big32(std::vector<std::uint8_t>& bytes, std::uint32_t value) {
    for (int i = 3; i >= 0; --i) bytes.push_back(static_cast<std::uint8_t>(value >> (8 * i)));
}
void variable(std::vector<std::uint8_t>& bytes, std::uint32_t value) {
    if (value > 0x0fffffff) throw std::runtime_error("MIDI delta exceeds four-byte VLQ");
    std::uint8_t pending[4];
    int count = 0;
    pending[count++] = static_cast<std::uint8_t>(value & 0x7f);
    while ((value >>= 7) != 0) pending[count++] = static_cast<std::uint8_t>((value & 0x7f) | 0x80);
    while (count > 0) bytes.push_back(pending[--count]);
}
}

std::vector<std::uint8_t> wave(const Processed& audio, int rate) {
    const auto dataSize = static_cast<std::uint32_t>(audio.pcm.size() * 2);
    std::vector<std::uint8_t> bytes;
    bytes.reserve(44 + dataSize);
    text(bytes, "RIFF"); little32(bytes, 36 + dataSize); text(bytes, "WAVE");
    text(bytes, "fmt "); little32(bytes, 16); little16(bytes, 1); little16(bytes, 1);
    little32(bytes, rate); little32(bytes, rate * 2); little16(bytes, 2); little16(bytes, 16);
    text(bytes, "data"); little32(bytes, dataSize);
    for (auto sample : audio.pcm) little16(bytes, static_cast<std::uint16_t>(sample));
    return bytes;
}

std::vector<std::uint8_t> midi(const Plan& plan) {
    constexpr std::uint16_t ppq = 480;
    const auto microseconds = static_cast<std::uint32_t>(std::llround(60000000.0 / plan.tempo));
    const auto tick = [microseconds](double milliseconds) {
        return static_cast<std::uint32_t>(std::llround(milliseconds * 1000.0 * ppq / microseconds));
    };
    struct Event { std::uint32_t at; std::uint8_t status, note, velocity; std::size_t ordinal; };
    std::vector<Event> events;
    for (const auto& line : plan.lines) {
        if (line.paid == 0) continue;
        const auto velocity = static_cast<std::uint8_t>(std::max<long long>(1, std::llround(line.paid * 127)));
        events.push_back({tick(line.due), 0x90, static_cast<std::uint8_t>(line.price), velocity, line.ordinal});
        events.push_back({tick(line.due + line.term), 0x80, static_cast<std::uint8_t>(line.price), 0, line.ordinal});
    }
    std::stable_sort(events.begin(), events.end(), [](const auto& a, const auto& b) {
        if (a.at != b.at) return a.at < b.at;
        if (a.status != b.status) return a.status < b.status;
        return a.ordinal < b.ordinal;
    });
    std::vector<std::uint8_t> track;
    track.insert(track.end(), {0, 0xff, 0x51, 3, static_cast<std::uint8_t>(microseconds >> 16),
        static_cast<std::uint8_t>(microseconds >> 8), static_cast<std::uint8_t>(microseconds)});
    const std::string name = "OmniCivitas WEB1";
    track.insert(track.end(), {0, 0xff, 3}); variable(track, name.size()); text(track, name);
    std::uint32_t previous = 0;
    for (const auto& event : events) {
        variable(track, event.at - previous);
        track.insert(track.end(), {event.status, event.note, event.velocity});
        previous = event.at;
    }
    variable(track, std::max(previous, tick(plan.durationMs)) - previous);
    track.insert(track.end(), {0xff, 0x2f, 0});
    std::vector<std::uint8_t> bytes;
    text(bytes, "MThd"); big32(bytes, 6); big16(bytes, 0); big16(bytes, 1); big16(bytes, ppq);
    text(bytes, "MTrk"); big32(bytes, track.size()); bytes.insert(bytes.end(), track.begin(), track.end());
    return bytes;
}

std::string encode64(const std::vector<std::uint8_t>& bytes) {
    constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string output;
    output.reserve((bytes.size() + 2) / 3 * 4);
    for (std::size_t i = 0; i < bytes.size(); i += 3) {
        const std::uint32_t value = static_cast<std::uint32_t>(bytes[i]) << 16 |
            (i + 1 < bytes.size() ? static_cast<std::uint32_t>(bytes[i + 1]) << 8 : 0) |
            (i + 2 < bytes.size() ? bytes[i + 2] : 0);
        output.push_back(alphabet[(value >> 18) & 63]); output.push_back(alphabet[(value >> 12) & 63]);
        output.push_back(i + 1 < bytes.size() ? alphabet[(value >> 6) & 63] : '=');
        output.push_back(i + 2 < bytes.size() ? alphabet[value & 63] : '=');
    }
    return output;
}

Json assemble(const Plan& plan) {
    const auto processed = process(invoice::BalanceSheet::synthesize(plan.lines, plan.sampleRate, plan.frames, plan.preset), plan);
    const auto wav = wave(processed, plan.sampleRate);
    Json midiValue = nullptr;
    std::size_t midiBytes = 0;
    if (plan.includeMidi) {
        const auto file = midi(plan);
        midiBytes = file.size();
        midiValue = encode64(file);
    }
    return {{"ok", true}, {"schemaVersion", 1}, {"engine", "ocv-site-audio/1"},
        {"audio", encode64(wav)}, {"midi", midiValue}, {"analysis", analyze(processed, plan)},
        {"wavBytes", wav.size()}, {"midiBytes", midiBytes}, {"tempo", plan.tempo},
        {"timeBase", "milliseconds; no tempo stretching"}, {"preset", plan.preset},
        {"midiMeaning", "note timing and velocity; audio filters and effects are WAV-only"},
        {"effects", {{"gain", plan.gain}, {"lowpassHz", plan.lowpassHz}, {"normalize", plan.normalize},
            {"echo", {{"delayMs", plan.echo.delayMs}, {"feedback", plan.echo.feedback}, {"mix", plan.echo.mix}, {"repeats", plan.echo.repeats}}}}}};
}
}
