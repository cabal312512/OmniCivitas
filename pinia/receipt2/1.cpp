#include "common.hh"
#include <iostream>
#include <cstring>

namespace {
std::string buffer;
std::string process(const std::string& text){
    try{return receipt::encode(receipt::run(receipt::Config(text).read()));}
    catch(const receipt::Failure& error){receipt::Data result=receipt::Data::dictionary();result["ok"]=false;result["schema"]="ocv.signals/1";result["engine"]="CE1/cpp-mna";result["version"]="1.0.0";result["diagnostics"]=receipt::Data::array();receipt::Data row=receipt::Data::dictionary();row["code"]=error.code;row["message"]=error.what();result["diagnostics"].list.push_back(row);return receipt::encode(result);}
    catch(const std::exception&){return "{\"ok\":false,\"engine\":\"CE1/cpp-mna\",\"diagnostics\":[{\"code\":\"INTERNAL\",\"message\":\"The bounded solver could not complete.\"}]}";}
}
}
extern "C" const char* ocv_run(const char* input){
    if(!input)return "{\"ok\":false,\"diagnostics\":[{\"code\":\"JSON\",\"message\":\"Null input.\"}]}";
    size_t length=0;while(length<=2097152&&input[length])++length;
    if(length>2097152)return "{\"ok\":false,\"diagnostics\":[{\"code\":\"LIMIT\",\"message\":\"Input exceeds 2 MiB.\"}]}";
    buffer=process(std::string(input,length));return buffer.c_str();
}
#ifndef __EMSCRIPTEN__
int main(){
    std::string request;char chunk[4096];while(std::cin){std::cin.read(chunk,sizeof chunk);request.append(chunk,size_t(std::cin.gcount()));if(request.size()>2097152){std::cout<<"{\"ok\":false,\"diagnostics\":[{\"code\":\"LIMIT\",\"message\":\"Input exceeds 2 MiB.\"}]}\n";return 0;}}
    std::cout<<process(request)<<'\n';return 0;
}
#endif
