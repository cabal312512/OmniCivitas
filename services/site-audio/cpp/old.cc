#include "aaa.hpp"
#include "config/8/RenderPolicy.hpp"
#include <iostream>
#include <stdexcept>

int main() {
    using media13::Json;
    try {
        std::string input;
        char block[4096];
        while (std::cin.read(block, sizeof(block)) || std::cin.gcount() > 0) {
            if (input.size() + static_cast<std::size_t>(std::cin.gcount()) > stock8::Common::inputBytes)
                throw std::invalid_argument("render request exceeds 128 KiB");
            input.append(block, static_cast<std::size_t>(std::cin.gcount()));
        }
        const auto parsed = Json::parse(input, [](int depth, Json::parse_event_t, Json&) {
            if (depth > 24) throw std::invalid_argument("render JSON nesting exceeds 24 levels");
            return true;
        });
        const auto result = media13::assemble(media13::readPlan(parsed)).dump();
        if (result.size() + 1 > stock8::Common::outputBytes) throw std::runtime_error("render result exceeds 4 MiB");
        std::cout << result << '\n';
        return 0;
    } catch (const Json::exception&) {
        std::cout << Json({{"ok", false}, {"code", "audio_invalid_json"}, {"error", "invalid render JSON"}}).dump() << '\n';
    } catch (const std::exception& error) {
        std::cout << Json({{"ok", false}, {"code", "audio_invalid_input"}, {"error", error.what()}}).dump() << '\n';
    }
    return 2;
}
