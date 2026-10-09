#pragma once
#include <algorithm>
#include <cmath>
#include <complex>
#include <cctype>
#include <cstdlib>
#include <iomanip>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace receipt {
struct Failure : std::runtime_error {
    std::string code;
    Failure(std::string c, std::string m):std::runtime_error(m),code(std::move(c)){}
};
struct Data {
    enum class Kind {Null, Boolean, Number, Text, List, Object};
    Kind kind=Kind::Null;
    bool flag=false;
    double number=0;
    std::string text;
    std::vector<Data> list;
    std::map<std::string,Data> object;
    Data()=default;
    Data(double x):kind(Kind::Number),number(x){}
    Data(bool x):kind(Kind::Boolean),flag(x){}
    Data(std::string x):kind(Kind::Text),text(std::move(x)){}
    Data(const char* x):Data(std::string(x)){}
    static Data array(){ Data d;d.kind=Kind::List;return d; }
    static Data dictionary(){ Data d;d.kind=Kind::Object;return d; }
    Data& operator[](const std::string& k){kind=Kind::Object;return object[k];}
    const Data& get(const std::string& k)const {
        static const Data empty;
        auto p=object.find(k);return p==object.end()?empty:p->second;
    }
    std::string str(const std::string& fallback="")const{return kind==Kind::Text?text:fallback;}
    double num(double fallback=0)const{return kind==Kind::Number?number:fallback;}
    bool boolean(bool fallback=false)const{return kind==Kind::Boolean?flag:fallback;}
};
inline void utf8(std::string& out,unsigned x) {
    if(x<128)out+=char(x);
    else if(x<2048){out+=char(192|(x>>6));out+=char(128|(x&63));}
    else if(x<65536){out+=char(224|(x>>12));out+=char(128|((x>>6)&63));out+=char(128|(x&63));}
    else{out+=char(240|(x>>18));out+=char(128|((x>>12)&63));out+=char(128|((x>>6)&63));out+=char(128|(x&63));}
}
inline bool validUtf8(const std::string& text){
    for(size_t at=0;at<text.size();){unsigned char first=text[at++];if(first<128)continue;unsigned length=0,code=0;
        if(first>=0xc2&&first<=0xdf){length=1;code=first&31;}else if(first>=0xe0&&first<=0xef){length=2;code=first&15;}else if(first>=0xf0&&first<=0xf4){length=3;code=first&7;}else return false;
        unsigned minimum=length==1?0x80:length==2?0x800:0x10000;
        for(unsigned i=0;i<length;++i){if(at>=text.size())return false;unsigned char next=text[at++];if((next&0xc0)!=0x80)return false;code=(code<<6)|(next&63);}
        if(code<minimum||code>0x10ffff||(code>=0xd800&&code<=0xdfff))return false;
    }return true;
}
class Config {
    const std::string& s;
    size_t at=0, tokens=0;
    void whitespace(){while(at<s.size()&&(s[at]==' '||s[at]=='\n'||s[at]=='\r'||s[at]=='\t'))++at;}
    char take(){if(at>=s.size())throw Failure("JSON","Unexpected end of JSON.");return s[at++];}
    unsigned hex4(){unsigned n=0;for(int i=0;i<4;++i){char c=take();n<<=4;if(c>='0'&&c<='9')n+=c-'0';else if(c>='a'&&c<='f')n+=c-'a'+10;else if(c>='A'&&c<='F')n+=c-'A'+10;else throw Failure("JSON","Invalid Unicode escape.");}return n;}
    std::string string(){
        if(take()!='"')throw Failure("JSON","Expected string.");
        std::string out;
        while(true){char c=take();if(c=='"')break;if(static_cast<unsigned char>(c)<32)throw Failure("JSON","Control character in string.");
            if(c!='\\'){out+=c;if(out.size()>65536)throw Failure("LIMIT","JSON string is too long.");continue;}char e=take();
            switch(e){case '"':out+='"';break;case '\\':out+='\\';break;case '/':out+='/';break;case 'b':out+='\b';break;case 'f':out+='\f';break;case 'n':out+='\n';break;case 'r':out+='\r';break;case 't':out+='\t';break;
                case 'u':{unsigned x=hex4();if(x>=0xd800&&x<=0xdbff){if(take()!='\\'||take()!='u')throw Failure("JSON","Unpaired surrogate.");unsigned y=hex4();if(y<0xdc00||y>0xdfff)throw Failure("JSON","Unpaired surrogate.");x=0x10000+((x-0xd800)<<10)+(y-0xdc00);}else if(x>=0xdc00&&x<=0xdfff)throw Failure("JSON","Unpaired surrogate.");utf8(out,x);break;}
                default:throw Failure("JSON","Invalid escape.");}
            if(out.size()>65536)throw Failure("LIMIT","JSON string is too long.");
        }if(!validUtf8(out))throw Failure("JSON","Invalid UTF-8.");return out;
    }
    Data value(unsigned depth){
        whitespace();if(depth>48||++tokens>100000)throw Failure("LIMIT","JSON structure exceeds limits.");
        if(at==s.size())throw Failure("JSON","Missing value.");char c=s[at];
        if(c=='"')return Data(string());
        if(c=='{'||c=='['){++at;Data d=c=='{'?Data::dictionary():Data::array();char end=c=='{'?'}':']';whitespace();if(at<s.size()&&s[at]==end){++at;return d;}
            while(true){if(c=='{'){whitespace();std::string k=string();whitespace();if(take()!=':')throw Failure("JSON","Missing colon.");if(d.object.count(k))throw Failure("JSON","Duplicate JSON key.");d.object.emplace(k,value(depth+1));}else d.list.push_back(value(depth+1));
                whitespace();char next=take();if(next==end)break;if(next!=',')throw Failure("JSON","Missing comma.");}
            return d;
        }
        for(auto p:std::vector<std::pair<std::string,Data>>{{"true",Data(true)},{"false",Data(false)},{"null",Data()}}){if(s.compare(at,p.first.size(),p.first)==0){at+=p.first.size();return p.second;}}
        size_t start=at;if(s[at]=='-')++at;if(at>=s.size()||!std::isdigit(static_cast<unsigned char>(s[at])))throw Failure("JSON","Expected number.");
        if(s[at]=='0')++at;else while(at<s.size()&&std::isdigit(static_cast<unsigned char>(s[at])))++at;
        if(at<s.size()&&s[at]=='.'){++at;size_t f=at;while(at<s.size()&&std::isdigit(static_cast<unsigned char>(s[at])))++at;if(f==at)throw Failure("JSON","Invalid fraction.");}
        if(at<s.size()&&(s[at]=='e'||s[at]=='E')){++at;if(at<s.size()&&(s[at]=='+'||s[at]=='-'))++at;size_t f=at;while(at<s.size()&&std::isdigit(static_cast<unsigned char>(s[at])))++at;if(f==at)throw Failure("JSON","Invalid exponent.");}
        std::string n=s.substr(start,at-start);double x=std::strtod(n.c_str(),nullptr);if(!std::isfinite(x))throw Failure("JSON","Non-finite number.");return Data(x);
    }
public:
    explicit Config(const std::string& source):s(source){}
    Data read(){if(s.size()>2097152)throw Failure("LIMIT","JSON input exceeds 2 MiB.");Data d=value(0);whitespace();if(at!=s.size())throw Failure("JSON","Trailing input.");return d;}
};
inline void quote(std::ostream& o,const std::string& s){o<<'"';for(unsigned char c:s){switch(c){case '"':o<<"\\\"";break;case '\\':o<<"\\\\";break;case '\n':o<<"\\n";break;case '\r':o<<"\\r";break;case '\t':o<<"\\t";break;default:if(c<32)o<<"\\u"<<std::hex<<std::setw(4)<<std::setfill('0')<<int(c)<<std::dec;else o<<char(c);}}o<<'"';}
inline void write(std::ostream& o,const Data& d){
    switch(d.kind){case Data::Kind::Null:o<<"null";break;case Data::Kind::Boolean:o<<(d.flag?"true":"false");break;case Data::Kind::Number:if(!std::isfinite(d.number))throw Failure("NUMERIC","Non-finite output.");o<<std::setprecision(15)<<d.number;break;case Data::Kind::Text:quote(o,d.text);break;
    case Data::Kind::List:{o<<'[';bool first=true;for(auto& v:d.list){if(!first)o<<',';first=false;write(o,v);}o<<']';break;}
    case Data::Kind::Object:{o<<'{';bool first=true;for(auto& p:d.object){if(!first)o<<',';first=false;quote(o,p.first);o<<':';write(o,p.second);}o<<'}';break;}}
}
inline std::string encode(const Data& d){std::ostringstream out;write(out,d);return out.str();}
Data run(const Data& request);
}
