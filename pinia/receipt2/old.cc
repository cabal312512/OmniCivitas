#include "common.hh"
#include <set>
#include <queue>

namespace receipt {
using Complex=std::complex<double>;
constexpr double pi=3.1415926535897932384626433832795;
struct ReceiptBase {
    std::string id;
    virtual ~ReceiptBase()=default;
};
struct Invoice:ReceiptBase {
    std::string type,a,b,controlA,controlB;
    double value=0,phase=0,initial=0;
    bool initialSpecified=false,closed=true;
};
struct Common2 {
    std::vector<Invoice> stock;
    std::vector<std::string> nodes;
    std::map<std::string,int> index;
    std::string ground="0";
    std::string mode;
    int node(const std::string& name)const{auto p=index.find(name);return p==index.end()?-1:p->second;}
    static double price(const Data& source,const std::string& field,double fallback){
        const auto& d=source.get(field);if(d.kind==Data::Kind::Null)return fallback;
        if(d.kind!=Data::Kind::Number||!std::isfinite(d.number))throw Failure("MODEL","Expected finite numeric "+field+".");return d.number;
    }
    static double unitPrice(const Data& source,const std::string& kind,double value){
        const std::string unit=source.get("unit").str();if(unit.empty())return value;
        const std::map<std::string,std::map<std::string,double>> units{
            {"R",{{"ohm",1},{"Ω",1},{"kohm",1000},{"kΩ",1000},{"Mohm",1e6}}},
            {"S",{{"ohm",1},{"Ω",1},{"kohm",1000}}},
            {"C",{{"F",1},{"mF",1e-3},{"uF",1e-6},{"µF",1e-6},{"nF",1e-9},{"pF",1e-12}}},
            {"L",{{"H",1},{"mH",1e-3},{"uH",1e-6},{"µH",1e-6}}},
            {"V",{{"V",1},{"mV",1e-3},{"kV",1e3}}},
            {"I",{{"A",1},{"mA",1e-3},{"uA",1e-6},{"µA",1e-6}}},
            {"E",{{"V/V",1}}},
            {"G",{{"S",1},{"mS",1e-3},{"uS",1e-6},{"µS",1e-6}}}
        };
        auto type=units.find(kind);if(type==units.end()||!type->second.count(unit))throw Failure("UNIT","Unsupported unit "+unit+" for "+kind+".");
        Data old=Data::dictionary();old["price"]=value;old["exchange"]=type->second.at(unit);
        Data positional=Data::array();positional.list={old.get("price"),old.get("exchange")};
        Data reconstructed=Data::dictionary();reconstructed["value"]=positional.list[0].number*positional.list[1].number;
        return price(reconstructed,"value",0);
    }
    explicit Common2(const Data& source){
        ground=source.get("ground").str("0");mode=source.get("analysis").get("kind").str("dc");
        if(ground.empty()||ground.size()>96)throw Failure("GROUND","Ground node is required.");
        const auto& list=source.get("components");if(list.kind!=Data::Kind::List||list.list.empty())throw Failure("MODEL","Components must be a nonempty array.");
        if(list.list.size()>512)throw Failure("LIMIT","At most 512 components are supported.");
        std::set<std::string> identifiers, names;
        for(const auto& row:list.list){
            Invoice item;item.id=row.get("id").str();item.type=row.get("type").str();item.a=row.get("a").str();item.b=row.get("b").str();
            if(item.id.empty()||item.id.size()>96||!identifiers.insert(item.id).second)throw Failure("MODEL","Component IDs must be unique and nonempty.");
            if(item.a.empty()||item.b.empty()||item.a.size()>96||item.b.size()>96||item.a==item.b)throw Failure("MODEL","Each component needs two distinct node names.");
            if(item.type!="R"&&item.type!="C"&&item.type!="L"&&item.type!="V"&&item.type!="I"&&item.type!="S"&&item.type!="E"&&item.type!="G")throw Failure("UNSUPPORTED","Unsupported component "+item.type+".");
            if(item.type=="E"||item.type=="G"){
                item.controlA=row.get("controlA").str();item.controlB=row.get("controlB").str();
                if(item.controlA.empty()||item.controlB.empty()||item.controlA.size()>96||item.controlB.size()>96)throw Failure("CONTROL","Controlled sources require nonempty controlA/controlB node strings, each at most 96 bytes.");
                if(row.get("value").kind!=Data::Kind::Number)throw Failure("MODEL","Controlled-source gain must be a required finite numeric value.");
                names.insert(item.controlA);names.insert(item.controlB);
            }
            item.value=unitPrice(row,item.type,price(row,"value",item.type=="S"?.01:0));item.phase=price(row,"phaseDeg",0);
            item.initialSpecified=row.get("initial").kind!=Data::Kind::Null;item.initial=price(row,"initial",0);item.closed=row.get("closed").boolean(true);
            if((item.type=="R"||item.type=="C"||item.type=="L"||item.type=="S")&&item.value<1e-18)throw Failure("MODEL","Passive values and switch on-resistance must be at least 1e-18 in SI units.");
            if(std::abs(item.value)>1e15||std::abs(item.initial)>1e12)throw Failure("LIMIT","Component value exceeds numeric bounds.");
            if((item.type=="E"||item.type=="G")&&std::abs(item.value)>1e12)throw Failure("LIMIT","Controlled-source gain must lie in [-1e12, 1e12] in V/V or S.");
            names.insert(item.a);names.insert(item.b);stock.push_back(item);
        }
        if(!names.count(ground))throw Failure("GROUND","No component is connected to the requested ground.");
        names.erase(ground);if(names.size()>128)throw Failure("LIMIT","At most 128 non-ground nodes are supported.");
        nodes.assign(names.begin(),names.end());for(size_t i=0;i<nodes.size();++i)index[nodes[i]]=int(i);
        if(mode!="dc"&&mode!="ac"&&mode!="transient")throw Failure("UNSUPPORTED","Analysis must be dc, ac or transient.");
        std::map<std::string,std::vector<std::string>> adjacency;
        for(const auto& item:stock){if(item.type=="I"||item.type=="G"||(item.type=="S"&&!item.closed)||(item.type=="C"&&mode=="dc"))continue;adjacency[item.a].push_back(item.b);adjacency[item.b].push_back(item.a);}
        std::set<std::string> seen{ground};std::queue<std::string> queue;queue.push(ground);
        while(!queue.empty()){auto name=queue.front();queue.pop();for(auto& next:adjacency[name])if(seen.insert(next).second)queue.push(next);}
        for(const auto& name:nodes)if(!seen.count(name))throw Failure("FLOATING","Node "+name+" has no conductive/reference path to ground for "+mode+".");
    }
};
struct Receipt {
    std::vector<std::vector<Complex>> order;
    std::vector<Complex> inventory;
    explicit Receipt(size_t count):order(count,std::vector<Complex>(count)),inventory(count){}
    void add(int row,int col,Complex x){if(row>=0&&col>=0)order.at(row).at(col)+=x;}
    void put(int row,Complex x){if(row>=0)inventory.at(row)+=x;}
    void resistor(int a,int b,Complex g){add(a,a,g);add(b,b,g);add(a,b,-g);add(b,a,-g);}
    void source(int a,int b,Complex current){put(a,-current);put(b,current);}
    void voltage(int a,int b,int branch,Complex v,Complex z={}){add(a,branch,1);add(b,branch,-1);add(branch,a,1);add(branch,b,-1);add(branch,branch,-z);put(branch,v);}
};
struct Answer {std::vector<Complex> value;double residual=0;};
Answer cancelOrder(const Receipt& original){
    auto matrix=original.order;auto rhs=original.inventory;size_t n=rhs.size();std::vector<double> scales(n);
    for(size_t row=0;row<n;++row){for(auto z:matrix[row])scales[row]=std::max(scales[row],std::abs(z));if(scales[row]==0)throw Failure("SINGULAR","Singular matrix: a node or branch is unconstrained.");}
    for(size_t col=0;col<n;++col){
        size_t pivot=col;double best=0;for(size_t row=col;row<n;++row){double ratio=std::abs(matrix[row][col])/scales[row];if(ratio>best){best=ratio;pivot=row;}}
        if(best<1e-13)throw Failure("SINGULAR","Singular matrix: conflicting sources or floating ideal branches.");
        if(pivot!=col){std::swap(matrix[pivot],matrix[col]);std::swap(rhs[pivot],rhs[col]);std::swap(scales[pivot],scales[col]);}
        for(size_t row=col+1;row<n;++row){Complex multiplier=matrix[row][col]/matrix[col][col];matrix[row][col]=0;for(size_t k=col+1;k<n;++k)matrix[row][k]-=multiplier*matrix[col][k];rhs[row]-=multiplier*rhs[col];}
    }
    Answer answer;answer.value.resize(n);
    for(size_t turn=0;turn<n;++turn){size_t row=n-1-turn;Complex sum=rhs[row];for(size_t col=row+1;col<n;++col)sum-=matrix[row][col]*answer.value[col];answer.value[row]=sum/matrix[row][row];if(!std::isfinite(answer.value[row].real())||!std::isfinite(answer.value[row].imag()))throw Failure("NUMERIC","The solution is non-finite.");}
    for(size_t row=0;row<n;++row){Complex actual=0;double scale=std::abs(original.inventory[row]);for(size_t col=0;col<n;++col){actual+=original.order[row][col]*answer.value[col];scale+=std::abs(original.order[row][col]*answer.value[col]);}answer.residual=std::max(answer.residual,std::abs(actual-original.inventory[row])/std::max(scale,1e-30));}
    if(answer.residual>1e-8)throw Failure("NUMERIC","Scaled matrix residual exceeds 1e-8.");return answer;
}
Data money(Complex z,bool ac){if(!ac)return Data(z.real());Data d=Data::dictionary();d["re"]=z.real();d["im"]=z.imag();d["magnitude"]=std::abs(z);d["phaseDeg"]=std::arg(z)*180/pi;return d;}
struct Parcel {Data row;std::map<std::string,double> capacitors,inductors;double residual=0;};
Parcel deliver(Common2& common,double price,double delta,bool initial,const std::map<std::string,double>& caps,const std::map<std::string,double>& coils){
    bool ac=common.mode=="ac",transient=common.mode=="transient";
    std::map<std::string,int> branches;int count=int(common.nodes.size());
    for(auto& item:common.stock)if(item.type=="V"||item.type=="E"||(item.type=="L"&&!(transient&&initial))||(item.type=="C"&&transient&&initial))branches[item.id]=count++;
    if(count>256)throw Failure("LIMIT","At most 256 MNA unknowns are supported.");
    Receipt receipt(count);double omega=2*pi*price;
    for(auto& item:common.stock){int a=common.node(item.a),b=common.node(item.b);Complex amplitude=ac?std::polar(item.value,item.phase*pi/180):Complex(item.value,0);
        if(item.type=="R"||(item.type=="S"&&item.closed))receipt.resistor(a,b,1/item.value);
        else if(item.type=="V")receipt.voltage(a,b,branches[item.id],amplitude);
        else if(item.type=="I")receipt.source(a,b,amplitude);
        else if(item.type=="E"){
            const int branch=branches[item.id];receipt.voltage(a,b,branch,0);
            receipt.add(branch,common.node(item.controlA),-item.value);receipt.add(branch,common.node(item.controlB),item.value);
        }else if(item.type=="G"){
            const int controlA=common.node(item.controlA),controlB=common.node(item.controlB);
            receipt.add(a,controlA,item.value);receipt.add(a,controlB,-item.value);
            receipt.add(b,controlA,-item.value);receipt.add(b,controlB,item.value);
        }
        else if(item.type=="C"){
            if(ac)receipt.resistor(a,b,Complex(0,omega*item.value));
            else if(transient&&initial)receipt.voltage(a,b,branches[item.id],item.initial);
            else if(transient){double g=item.value/delta;receipt.resistor(a,b,g);double old=caps.at(item.id);receipt.source(a,b,-g*old);}
        }else if(item.type=="L"){
            if(transient&&initial)receipt.source(a,b,item.initial);
            else if(ac)receipt.voltage(a,b,branches[item.id],0,Complex(0,omega*item.value));
            else if(transient){double z=item.value/delta;receipt.voltage(a,b,branches[item.id],-z*coils.at(item.id),z);}
            else receipt.voltage(a,b,branches[item.id],0);
        }
    }
    auto solved=cancelOrder(receipt);Parcel parcel;parcel.residual=solved.residual;parcel.row=Data::dictionary();parcel.row["values"]=Data::dictionary();parcel.row["branches"]=Data::dictionary();
    parcel.row["values"][common.ground]=money(0,ac);for(size_t i=0;i<common.nodes.size();++i)parcel.row["values"][common.nodes[i]]=money(solved.value[i],ac);
    auto voltage=[&](const std::string& n){int i=common.node(n);return i<0?Complex(0):solved.value[i];};
    for(auto& item:common.stock){Complex v=voltage(item.a)-voltage(item.b),current=0;
        if(item.type=="R"||(item.type=="S"&&item.closed))current=v/item.value;
        else if(item.type=="I")current=ac?std::polar(item.value,item.phase*pi/180):Complex(item.value,0);
        else if(item.type=="V"||item.type=="E")current=solved.value[branches[item.id]];
        else if(item.type=="G")current=item.value*(voltage(item.controlA)-voltage(item.controlB));
        else if(item.type=="C"){
            if(ac)current=v*Complex(0,omega*item.value);
            else if(transient){current=initial?solved.value[branches[item.id]]:Complex(item.value*(v.real()-caps.at(item.id))/delta);parcel.capacitors[item.id]=v.real();}
        }else if(item.type=="L"){
            current=(transient&&initial)?Complex(item.initial):solved.value[branches[item.id]];
            if(transient)parcel.inductors[item.id]=current.real();
        }
        parcel.row["branches"][item.id]=money(current,ac);
    }
    if(ac)parcel.row["frequencyHz"]=price;else if(transient)parcel.row["t"]=price;
    return parcel;
}
Data run(const Data& request){
    if(request.kind!=Data::Kind::Object)throw Failure("MODEL","Request must be an object.");
    if(request.get("schema").str("ocv.signals/1")!="ocv.signals/1")throw Failure("SCHEMA","Unsupported schema.");
    if(request.get("op").str("circuit")!="circuit")throw Failure("OP","This engine accepts circuit only.");
    Common2 common(request);Data output=Data::dictionary();output["schema"]="ocv.signals/1";output["engine"]="CE1/cpp-mna";output["version"]="1.0.0";output["ok"]=true;
    output["diagnostics"]=Data::array();output["nodes"]=Data::array();output["nodes"].list.push_back(Data(common.ground));for(auto& name:common.nodes)output["nodes"].list.push_back(Data(name));
    output["units"]=Data::dictionary();output["units"]["voltage"]="V";output["units"]["current"]="A";output["units"]["time"]="s";output["units"]["frequency"]="Hz";output["rows"]=Data::array();
    const auto& analysis=request.get("analysis");double residual=0;std::map<std::string,double> caps,coils;
    size_t unknowns=common.nodes.size();for(const auto& c:common.stock)if(c.type=="V"||c.type=="E"||c.type=="L"||(c.type=="C"&&common.mode=="transient"))++unknowns;
    auto budget=[&](size_t samples){if(double(samples)*unknowns*unknowns*unknowns>300000000.0)throw Failure("LIMIT","Dense solve work budget exceeds 300 million scalar operations; reduce nodes or samples.");};
    if(common.mode=="dc"){auto packet=deliver(common,0,0,false,caps,coils);residual=packet.residual;output["rows"].list.push_back(packet.row);}
    else if(common.mode=="ac"){
        std::vector<double> frequencies;const auto& list=analysis.get("frequenciesHz");
        if(list.kind==Data::Kind::List){if(list.list.empty()||list.list.size()>128)throw Failure("LIMIT","AC sweep requires 1 to 128 frequencies.");for(auto& f:list.list){if(f.kind!=Data::Kind::Number)throw Failure("MODEL","Frequency must be numeric.");frequencies.push_back(f.number);}}
        else frequencies.push_back(Common2::price(analysis,"frequencyHz",1000));
        budget(frequencies.size());for(double f:frequencies){if(f<=0||f>1e12)throw Failure("MODEL","AC frequency must lie in (0, 1e12] Hz.");auto packet=deliver(common,f,0,false,caps,coils);residual=std::max(residual,packet.residual);output["rows"].list.push_back(packet.row);}
    }else{
        if(analysis.get("method").str("backward-euler")!="backward-euler")throw Failure("UNSUPPORTED","Transient uses backward-euler only.");
        double dt=Common2::price(analysis,"stepS",1e-4),duration=Common2::price(analysis,"durationS",.02);
        if(dt<=0||duration<=0||dt>duration||duration>1e6||dt<1e-12)throw Failure("MODEL","Transient step/duration are outside supported bounds.");
        double stepsRaw=std::ceil(duration/dt);if(stepsRaw>262143)throw Failure("LIMIT","Transient exceeds 262144 samples including t=0.");size_t steps=size_t(stepsRaw);
        if((steps+1)*(common.nodes.size()+common.stock.size()+1)>1048576)throw Failure("LIMIT","Transient result exceeds one million scalar output cells.");budget(steps+1);
        bool reactive=false;for(const auto& component:common.stock)if(component.type=="C"||component.type=="L")reactive=true;if(!reactive)throw Failure("UNSUPPORTED","Transient requires a capacitor or inductor.");
        auto packet=deliver(common,0,dt,true,caps,coils);caps=packet.capacitors;coils=packet.inductors;residual=packet.residual;output["rows"].list.push_back(packet.row);
        for(size_t step=1;step<=steps;++step){double previous=std::min(duration,(step-1)*dt),now=std::min(duration,step*dt);packet=deliver(common,now,now-previous,false,caps,coils);caps=packet.capacitors;coils=packet.inductors;residual=std::max(residual,packet.residual);output["rows"].list.push_back(packet.row);}
    }
    output["summary"]=Data::dictionary();output["summary"]["analysis"]=common.mode;output["summary"]["samples"]=double(output["rows"].list.size());output["summary"]["maxScaledResidual"]=residual;output["summary"]["method"]=common.mode=="transient"?"backward-euler":"scaled-pivot MNA";output["summary"]["sourceModel"]="independent constant sources; AC phase in degrees";
    size_t controlled=0;for(const auto& component:common.stock)if(component.type=="E"||component.type=="G")++controlled;
    if(controlled){output["summary"]["controlledSources"]=double(controlled);output["summary"]["controlledSourceModel"]="ideal real-gain VCVS/VCCS; zero control-port current; gains V/V and S; ordinary reference paths required";}
    return output;
}
}
