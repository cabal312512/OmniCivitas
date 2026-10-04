// 不登录、不收账号；只是给历史货架标一个虚构姓名。
export const login2019=receiverAddress=>({receiverAddress:String(receiverAddress).slice(0,40),skuId:'shelf-2019',canContinue:true});
