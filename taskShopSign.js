/*
店铺签到
cron: 43 0,21 * * * taskShopSign.js
*/
const Env = require("./Env");
const $ = new Env("店铺签到");

const JsonFiles = {
    shops: './datas/shops.json',
    shopTokens: './datas/shopTokens.json',
};

const JsonDatas = {
    shops: {},
    shopTokens: [],
};

let newTokens = [];

$.onBefore = async function() {
    await initDatas();
    checkNewTokens();
}

$.onFirst = async function() {
    await checkAllTokens();
    sortTokens();
    printTokens();
}

$.onLogic = async function() {
    await signAll();
}

$.onAfter = async function() {
    await saveDatas();
}

$.run({fileName: __filename});

async function initDatas() {
    JsonDatas.shops = await $.readJSON(JsonFiles.shops);
    JsonDatas.shopTokens = await $.readJSON(JsonFiles.shopTokens);
    if (process.env.SHOP_SIGN_NEW) {
        newTokens = process.env.SHOP_SIGN_NEW.split('\n');
    }
}

async function saveDatas() {
    await $.writeJSON(JsonFiles.shops, JsonDatas.shops);
    await $.writeJSON(JsonFiles.shopTokens, JsonDatas.shopTokens);
    process.env.SHOP_SIGN_NEW = '';
}

function sortTokens() {
    JsonDatas.shopTokens = JsonDatas.shopTokens.filter(o => o.vaild); //删除失效的
    JsonDatas.shopTokens = JsonDatas.shopTokens.sort(function(a, b) {
        if (a.fixIdx !== b.fixIdx) return a.fixIdx - b.fixIdx;
        if (a.dailyBeans !== b.dailyBeans) return b.dailyBeans - a.dailyBeans;
        if (a.beans !== b.beans) return b.beans - a.beans;
        if (a.dailyScores !== b.dailyScores) return b.dailyScores - a.dailyScores;
        if (a.scores !== b.scores) return b.scores - a.scores;
        return a.index - b.index;
    });
}

function printTokens() {
    $.pushMsg('\n今日签到店铺：');
    let index = 0;
    for (let i = 0; i < JsonDatas.shopTokens.length; i++) {
        const item = JsonDatas.shopTokens[i];
        index++;
        item.index = index;
        const shopName = item.shopName?.replace(/京东|自营|官方|旗舰店/g, '');
        $.pushMsg(`${$.pad(item.index)}|${$.pad(item.days)}|${shopName}`);
    }
}

function checkNewTokens() {
    for (const token of newTokens) {
        let index = JsonDatas.shopTokens.findIndex(o => o.token === token);
        if (index >= 0) continue;
        JsonDatas.shopTokens.push({token, fixIdx:9, vaild: true});
    }
}

function formatUserPirzeStatus(userPirzeStatus) {
    switch (userPirzeStatus) {
        case 1: return '可领取';
        case 2: return '已领取';
        case 4: return '已抢完';
        default: return userPirzeStatus;
    }
}

function formatUserPrizeRuleStatus(userPrizeRuleStatus) {
    switch (userPrizeRuleStatus) {
        case 1: return '可领取';
        case 2: return '已领取';
        case 3: return '已抢完';
        default: return userPirzeStatus;
    }
}

function formatPrizeItem(pi) {
    switch (pi.type) {
        case 1: return `优惠券[${pi.quota}-${pi.discount}]`;
        case 4: return `京豆[${pi.discount}]`;
        case 6: return `积分[${pi.discount}]`;
        case 14: return `红包[${pi.discount/100}]`;
        default: return JSON.stringify(pi);
    }
}

async function checkAllTokens() {
    $.log('开始检查店铺状态');
    let index = 0;
    for (let i = 0; i < JsonDatas.shopTokens.length; i++) {
        const item = JsonDatas.shopTokens[i];
        index++;
        item.index = index;
        // console.log(item);
        if (!item.vaild) continue;
        const info = await getActivityInfo(item.token);
        let shopName = item.shopName ? item.shopName.replace(/京东|自营|官方|旗舰店/g, '') : item.token;
        if (!info) {
            $.pushMsg(`异常|${shopName}`);
        } else if (info.code == '-1') {
            $.pushMsg(`限流|${shopName}`);
        } else if (info.code == 402) {
            $.pushMsg(`失效|${shopName}`);
            item.vaild = false;
        } else if (info.code != 200) {
            $.pushMsg(`失效|${shopName}, ${JSON.stringify(info)}`);
        } else {
            item.vaild = true;
            const data = info.data;
            item.venderId = data.venderId;
            item.activityId = data.id;
            item.shopName = shopName = await getShopName(data.venderId);
            item.days = await getSignRecord(item);
            
            if (!item.fixIdx) item.fixIdx = 99;

            item.dailyPrizes = [];
            item.dailyBeans = 0;
            item.dailyScores = 0;
            for (const cpri of data.prizeRuleList) {
                let str = `每日签到[${formatUserPrizeRuleStatus(cpri.userPrizeRuleStatus)}]：`;
                for (const pi of cpri.prizeList) {
                    if (pi.userPirzeStatus == 1) {
                        if (pi.type == 6) item.dailyScores += pi.discount;
                        else if (pi.type == 4) item.dailyBeans += pi.discount;
                    }
                    str += `${formatPrizeItem(pi)}[${formatUserPirzeStatus(pi.userPirzeStatus)}]`;
                }
                item.dailyPrizes.push(str);
                // $.log(str);
            }

            item.prizes = [];
            item.beans = 0;
            item.scores = 0;
            for (const cpri of data.continuePrizeRuleList) {
                let str = `连签${cpri.days}天[${formatUserPrizeRuleStatus(cpri.userPrizeRuleStatus)}]：`;
                for (const pi of cpri.prizeList) {
                    if (pi.userPirzeStatus == 1) {
                        if (pi.type == 6) item.scores += pi.discount;
                        else if (pi.type == 4) item.beans += pi.discount;
                    }
                    str += `${formatPrizeItem(pi)}[${formatUserPirzeStatus(pi.userPirzeStatus)}]`;
                }
                item.prizes.push(str);
                // $.log(str);
            }

            if (item.dailyBeans + item.beans + item.dailyScores + item.scores <= 0) item.fixIdx = 99;

            $.log(`正常|${$.pad(item.days)}|${item.dailyBeans}|${$.pad(item.beans,3)}|${$.pad(item.dailyScores)}|${$.pad(item.scores,3)}|${shopName}`);
        }
    }
}

async function signAll() {
    const successList = [];
    const signedList = [];
    const limitList = [];
    const invalidList = [];
    for (let i = 0; i < JsonDatas.shopTokens.length; i++) {
        const item = JsonDatas.shopTokens[i];
        if (!item.vaild) continue;
        const signInfo = await sign(item);
        // $.log(`"signInfo":${JSON.stringify(signInfo)}`);
        // item.days = await getSignRecord(item);
        if (signInfo.code == 403030023) {
            // $.pushMsg(`[${$.pad(item.index)}]已签[${days}]`);
            signedList.push(item.index);
        } else if (signInfo.code == -1) {
            limitList.push(item.index);
        } else if (signInfo.code == 404130026) {
            $.pushMsg(`${$.pad(item.index)}|已达上限`);
            break;
        } else if (signInfo.code == 402) {
            // $.pushMsg(`[${$.pad(item.index)}]失效[${days}]`);
            invalidList.push(item.index);
            item.vaild = false;
        } else if (signInfo.code == 200) {
            successList.push(item.index);
            // $.pushMsg(`[${$.pad(item.index)}]成功[${days}]`);
        } else {
            $.pushMsg(`${$.pad(item.index)}|失败|${signInfo.code}|${signInfo.msg}`);
        }
    }
    if (successList.length > 0) $.pushMsg(`成功|${JSON.stringify(successList)}`);
    if (signedList.length > 0) $.pushMsg(`已签|${JSON.stringify(signedList)}`);
    if (limitList.length > 0) $.pushMsg(`限流|${JSON.stringify(limitList)}`);
    if (invalidList.length > 0) $.pushMsg(`失效|${JSON.stringify(invalidList)}`);
}

async function sign({token, venderId, activityId}) {
    try {
        const url = `https://api.m.jd.com/api?appid=interCenter_shopSign&t=${Date.now()}&loginType=2&functionId=interact_center_shopSign_signCollectGift&body={%22token%22:%22${token}%22,%22venderId%22:${venderId},%22activityId%22:${activityId},%22type%22:56,%22actionType%22:7}`;
        const response = await $.get(url);
        return response.data;
    } catch (error) {
        $.log(error.message);
    }
}

async function getSignRecord({token, venderId, activityId}) {
    try {
        const url = `https://api.m.jd.com/api?appid=interCenter_shopSign&t=${Date.now()}&loginType=2&functionId=interact_center_shopSign_getSignRecord&body={%22token%22:%22${token}%22,%22venderId%22:${venderId},%22activityId%22:${activityId},%22type%22:56}`;
        const response = await $.get(url);
        // console.log(response.data);
        const data = response.data;
        if (data.data) return data.data.days;
    } catch (error) {
        $.log(error.message);
    }
    return '';
}

async function getActivityInfo(token) {
    try {
        const url = `https://api.m.jd.com/api?appid=interCenter_shopSign&t=${$.timestamp()}&loginType=2&functionId=interact_center_shopSign_getActivityInfo&body={%22token%22:%22${token}%22,%22venderId%22:%22%22}`;
        const response = await $.get(url);
        // console.log(response.data);
        return response.data;
    } catch (error) {
        $.log(error.message);
    }
}

async function getShopName(venderId) {
    if ($.has(JsonDatas.shops, venderId)) return JsonDatas.shops[venderId];

    try {
        const url = `https://api.m.jd.com/client.action?functionId=whx_getMShopDetail&body={"venderId":"${venderId}","source":"m-shop"}&appid=shop_view`;
        let response = await $.get(url);
        const data = response.data;
        // console.log(data);
        let shopName = data?.data?.shopBaseInfo?.shopName || venderId.toString();
        JsonDatas.shops[venderId] = shopName;
        return shopName;
    } catch (error) {
        $.log(error.message);
        return venderId;
    }
}