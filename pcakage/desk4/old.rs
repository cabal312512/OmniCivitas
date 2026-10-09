use crate::common::{Data,Answer,Issue,integer,number};
use std::f64::consts::TAU;

pub fn crc8(bits:&[u8])->u8{
    let mut crc=0u8;for &bit in bits{let high=((crc>>7)&1)^bit;crc<<=1;if high!=0{crc^=0x07;}}crc
}
struct Common2{state:u64,spare:Option<f64>}
struct WarehouseStock{ordered:usize,missing:usize,rejected:bool}
impl Common2{
    fn random(&mut self)->f64{self.state^=self.state>>12;self.state^=self.state<<25;self.state^=self.state>>27;let n=self.state.wrapping_mul(2685821657736338717);((n>>11)as f64+0.5)/9007199254740992.0}
    fn price(&mut self)->f64{if let Some(x)=self.spare.take(){return x;}let radius=(-2.0*self.random().ln()).sqrt();let angle=TAU*self.random();self.spare=Some(radius*angle.sin());radius*angle.cos()}
}
fn bits(text:&str)->Answer<Vec<u8>>{if text.is_empty()||text.len()>32760{return Err(Issue::new("LIMIT","Payload needs 1 to 32760 bits."));}text.bytes().map(|b|match b{b'0'=>Ok(0),b'1'=>Ok(1),_=>Err(Issue::new("MODEL","Payload accepts only 0 and 1."))}).collect()}
fn binary(bits:&[u8])->String{bits.iter().map(|b|char::from(b'0'+b)).collect()}
fn rf_value(radio:&Data,key:&str,min:f64,max:f64)->Answer<f64>{
    let value=radio.get(key).number().ok_or_else(||Issue::new("RF_MODEL",format!("rf.{key} must be a required finite number.")))?;
    if !value.is_finite()||!(min..=max).contains(&value){return Err(Issue::new("RF_LIMIT",format!("rf.{key} must lie in [{min}, {max}].")));}Ok(value)
}
pub(crate) fn link_budget(radio:&Data)->Answer<Data>{
    let receipt=radio.map().ok_or_else(||Issue::new("RF_MODEL","rf must be an object containing the ten link-budget parameters."))?;
    let columns=["frequencyMHz","distanceKm","txPowerDbm","txGainDbi","rxGainDbi","lossDb","bandwidthHz","bitRateBps","noiseFigureDb","requiredEbN0Db"];
    if receipt.len()!=columns.len()||receipt.keys().any(|key|!columns.contains(&key.as_str())){return Err(Issue::new("RF_MODEL","rf requires exactly the ten documented link-budget fields; unknown or missing fields are rejected."));}
    let f=rf_value(radio,"frequencyMHz",1.0,1e6)?*1e6;
    let distance=rf_value(radio,"distanceKm",0.001,1e7)?*1e3;
    let transmit=rf_value(radio,"txPowerDbm",-100.0,100.0)?;
    let transmit_gain=rf_value(radio,"txGainDbi",-50.0,100.0)?;
    let receive_gain=rf_value(radio,"rxGainDbi",-50.0,100.0)?;
    let loss=rf_value(radio,"lossDb",0.0,200.0)?;
    let bandwidth=rf_value(radio,"bandwidthHz",1.0,1e12)?;
    let rate=rf_value(radio,"bitRateBps",1.0,1e12)?;
    let noise_figure=rf_value(radio,"noiseFigureDb",0.0,100.0)?;
    let required=rf_value(radio,"requiredEbN0Db",-20.0,60.0)?;
    let c=299_792_458.0;let k=1.380_649e-23;let temperature=290.0;
    let wavelength=c/f;let free_space_loss=20.0*(2.0*TAU*distance/wavelength).log10();
    let eirp=transmit+transmit_gain;let received=eirp+receive_gain-free_space_loss-loss;
    let density=10.0*(k*temperature*1000.0_f64).log10();
    let thermal=density+10.0*bandwidth.log10();let noise=thermal+noise_figure;
    let snr=received-noise;let eb=snr+10.0*(bandwidth/rate).log10();
    let capacity=bandwidth*10.0_f64.powf(snr/10.0).ln_1p()/std::f64::consts::LN_2;
    Ok(Data::object([
        ("model","free-space LOS / 290 K".into()),("freeSpaceLossDb",free_space_loss.into()),("eirpDbm",eirp.into()),("receivedDbm",received.into()),
        ("noiseDensityDbmHz",density.into()),("thermalNoiseDbm",thermal.into()),("noiseDbm",noise.into()),("snrDb",snr.into()),("ebN0Db",eb.into()),
        ("capacityBps",capacity.into()),("marginDb",(eb-required).into()),("fresnelRadiusM",(wavelength*distance/4.0).sqrt().into()),("wavelengthM",wavelength.into()),
        ("temperatureK",temperature.into()),("channelCoupled",false.into()),("geometryDerived",false.into()),
        ("assumptions","Ideal free-space far-field line of sight; lossDb is aggregate additional loss. No antenna aperture, obstruction, multipath, atmosphere, terrain or topology-distance model. Fresnel radius is the paraxial first-zone midpoint approximation; AWGN parameters remain independent.".into())
    ]))
}
pub fn run(input:&Data)->Answer<Data>{
    let budget=if input.map().is_some_and(|map|map.contains_key("rf")){Some(link_budget(input.get("rf"))?)}else{None};
    let payload=bits(input.get("bits").text().unwrap_or("1011001010110001"))?;
    if input.get("crc").text().unwrap_or("CRC-8")!="CRC-8"{return Err(Issue::new("UNSUPPORTED","Stage 10 supports CRC-8 polynomial 0x07 only."));}
    if input.get("modulation").text().unwrap_or("BPSK")!="BPSK"{return Err(Issue::new("UNSUPPORTED","Stage 10 supports unit-energy BPSK only."));}
    let seed=integer(input,"seed",42,0,4294967295)? as u64;
    let sps=integer(input,"samplesPerSymbol",8,2,32)?;
    let fs=number(input,"sampleRateHz",8000.0)?;let eb=number(input,"ebN0Db",8.0)?;
    if !(1.0..=1e9).contains(&fs)||!(-30.0..=60.0).contains(&eb){return Err(Issue::new("LIMIT","Sample rate or Eb/N0 exceeds supported bounds."));}
    let noiseless=input.get("noiseless").flag().unwrap_or(false);let sigma=if noiseless{0.0}else{(0.5/10f64.powf(eb/10.0)).sqrt()};
    let check=crc8(&payload);let mut tx=payload.clone();tx.extend((0..8).rev().map(|shift|(check>>shift)&1));
    if tx.len()*sps>262144{return Err(Issue::new("LIMIT","Waveform exceeds 262144 samples."));}
    let mut generator=Common2{state:if seed==0{0x9e3779b97f4a7c15}else{seed},spare:None};let scale=1.0/(sps as f64).sqrt();
    let mut decoded=Vec::with_capacity(tx.len());let mut wave=Vec::with_capacity(tx.len()*sps);let mut constellation=Vec::with_capacity(tx.len());let mut eye=Vec::new();
    for(index,&bit)in tx.iter().enumerate(){let amplitude=if bit==0{-1.0}else{1.0};let mut i=0.0;let mut q=0.0;
        for sample in 0..sps{let transmitted=amplitude*scale;let received=transmitted+sigma*generator.price();let quadrature=sigma*generator.price();i+=received*scale;q+=quadrature*scale;
            wave.push(Data::object([("t",((index*sps+sample)as f64/fs).into()),("tx",transmitted.into()),("rx",received.into()),("q",quadrature.into())]));
            if index<256{eye.push(Data::object([("phase",(sample as f64/sps as f64).into()),("rx",received.into()),("index",index.into())]));}
        }
        decoded.push(if i>=0.0{1}else{0});constellation.push(Data::object([("i",i.into()),("q",q.into()),("bit",(bit as usize).into()),("index",index.into())]));
    }
    let payload_errors=payload.iter().zip(&decoded).filter(|(a,b)|a!=b).count();let frame_errors=tx.iter().zip(&decoded).filter(|(a,b)|a!=b).count();let recovered=&decoded[..payload.len()];let mut received_crc=0u8;for bit in &decoded[payload.len()..]{received_crc=(received_crc<<1)|*bit;}
    let stock=WarehouseStock{ordered:payload.len(),missing:payload_errors,rejected:crc8(recovered)!=received_crc};
    let n=stock.ordered as f64;let p=stock.missing as f64/n;let z=1.959963984540054;let denominator=1.0+z*z/n;let center=(p+z*z/(2.0*n))/denominator;let radius=z*((p*(1.0-p)/n+z*z/(4.0*n*n)).sqrt())/denominator;
    let mut result=Data::object([
        ("payloadBits",binary(&payload).into()),("decodedBits",binary(recovered).into()),("txBits",binary(&tx).into()),("rxBits",binary(&decoded).into()),
        ("crcValid",(!stock.rejected).into()),("bitErrors",stock.missing.into()),("frameBitErrors",frame_errors.into()),("ber",p.into()),("payloadLength",stock.ordered.into()),("frameLength",tx.len().into()),
        ("waveform",Data::List(wave)),("constellation",Data::List(constellation)),("eye",Data::List(eye)),("interval",Data::object([("lower",(center-radius).max(0.0).into()),("upper",(center+radius).min(1.0).into()),("confidence",0.95.into())])),
        ("summary",Data::object([("seed",(seed as f64).into()),("sigma",sigma.into()),("ebN0Db",eb.into()),("samplesPerSymbol",sps.into()),("sampleRateHz",fs.into()),("symbolRateHz",(fs/sps as f64).into()),("noiseless",noiseless.into()),("crc","CRC-8".into()),("crcPolynomial","0x07".into()),("crcInit",0.0.into()),("crcXorOut",0.0.into()),("modulation","BPSK".into()),("channel","complex baseband AWGN; unit energy per bit".into())]))
    ]);
    if let(Some(budget),Data::Receipt(ref mut map))=(budget,&mut result){map.insert("linkBudget".into(),budget);}
    Ok(result)
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn crc_standard_check(){let input=b"123456789".iter().flat_map(|byte|(0..8).rev().map(move|shift|(byte>>shift)&1)).collect::<Vec<_>>();assert_eq!(crc8(&input),0xf4);}
    #[test]fn noiseless_roundtrip(){let request=Data::object([("bits","10100110".into()),("noiseless",true.into())]);let output=run(&request).unwrap();assert_eq!(output.get("bitErrors").number(),Some(0.0));assert_eq!(output.get("crcValid").flag(),Some(true));assert_eq!(output.get("decodedBits").text(),Some("10100110"));}
    #[test]fn seeded_channel_is_reproducible(){let request=Data::object([("bits","0101110001".into()),("seed",915.0.into()),("ebN0Db",0.0.into())]);assert_eq!(run(&request).unwrap(),run(&request).unwrap());}
    fn radio()->Data{Data::object([("frequencyMHz",1000.0.into()),("distanceKm",1.0.into()),("txPowerDbm",30.0.into()),("txGainDbi",12.0.into()),("rxGainDbi",12.0.into()),("lossDb",3.0.into()),("bandwidthHz",1e6.into()),("bitRateBps",250000.0.into()),("noiseFigureDb",5.0.into()),("requiredEbN0Db",10.0.into())])}
    #[test]fn rf_published_scale_and_power_identities(){let x=link_budget(&radio()).unwrap();let n=|key|x.get(key).number().unwrap();assert!((n("freeSpaceLossDb")-92.44778322188337).abs()<1e-10);assert!((n("eirpDbm")-42.0).abs()<1e-12);assert!((n("receivedDbm")-(51.0-n("freeSpaceLossDb"))).abs()<1e-12);assert!((n("noiseDensityDbmHz")+173.97518719422808).abs()<1e-10);assert!((n("snrDb")-(n("receivedDbm")-n("noiseDbm"))).abs()<1e-12);assert!((n("ebN0Db")-(n("snrDb")+10.0*4.0_f64.log10())).abs()<1e-12);assert!((n("marginDb")-(n("ebN0Db")-10.0)).abs()<1e-12);assert!((n("fresnelRadiusM")-(299.792458_f64/4.0).sqrt()).abs()<1e-12);assert!(n("capacityBps")>1e6);}
    #[test]fn rf_does_not_change_awgn_and_absence_keeps_old_shape(){let plain=Data::object([("bits","010111".into()),("seed",42.0.into()),("ebN0Db",2.0.into())]);let expected=run(&plain).unwrap();assert!(expected.map().unwrap().get("linkBudget").is_none());let mut enriched=plain.clone();if let Data::Receipt(ref mut map)=enriched{map.insert("rf".into(),radio());}let mut actual=run(&enriched).unwrap();if let Data::Receipt(ref mut map)=actual{map.remove("linkBudget");}assert_eq!(actual,expected);}
    #[test]fn rf_rejects_unknown_missing_nonnumeric_and_out_of_range(){let base=radio();for(key,value)in[("distanceKm",0.0.into()),("txPowerDbm",101.0.into()),("noiseFigureDb",true.into()),("frequencyMHz",Data::Price(f64::INFINITY)),("typo",1.0.into())]{let mut input=base.clone();if let Data::Receipt(ref mut map)=input{map.insert(key.into(),value);}assert!(link_budget(&input).is_err());}let mut missing=base;if let Data::Receipt(ref mut map)=missing{map.remove("rxGainDbi");}assert!(link_budget(&missing).is_err());assert!(link_budget(&Data::Null).is_err());}
}
