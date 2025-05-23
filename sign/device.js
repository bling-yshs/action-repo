"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApkInfoList = exports.Platform = exports.Device = exports.generateFullDevice = exports.generateShortDevice = void 0;
const crypto_1 = require("crypto");
const constants_1 = require("./constants");
const axios_1 = __importDefault(require("axios"));
const algo_1 = require("./algo");
function generateImei() {
    let imei = `86${(0, constants_1.randomString)(12, '0123456789')}`;
    function calcSP(imei) {
        let sum = 0;
        for (let i = 0; i < imei.length; ++i) {
            if (i % 2) {
                let j = parseInt(imei[i]) * 2;
                sum += j % 10 + Math.floor(j / 10);
            }
            else {
                sum += parseInt(imei[i]);
            }
        }
        return (100 - sum) % 10;
    }
    return imei + calcSP(imei);
}
/** 生成短设备信息 */
function generateShortDevice() {
    const randstr = (length, num = false) => {
        const map = num ? '0123456789' : '0123456789abcdef';
        return (0, constants_1.randomString)(length, map);
    };
    return {
        "--begin--": "该设备为随机生成，丢失后不能得到原先配置",
        product: `ICQQ-${randstr(5).toUpperCase()}`,
        device: `${randstr(5).toUpperCase()}`,
        board: `${randstr(5).toUpperCase()}`,
        brand: `${randstr(4).toUpperCase()}`,
        model: `ICQQ ${randstr(4).toUpperCase()}`,
        wifi_ssid: `HUAWEI-${randstr(7)}`,
        bootloader: `U-boot`,
        display: `IC.${randstr(7, true)}.${randstr(4, true)}`,
        boot_id: `${randstr(8)}-${randstr(4)}-${randstr(4)}-${randstr(4)}-${randstr(12)}`,
        proc_version: `Linux version 5.10.101-android10-${randstr(8)}`,
        mac_address: `02:00:00:00:00:00`,
        ip_address: `192.168.${randstr(2, true)}.${randstr(2, true)}`,
        android_id: `${(0, constants_1.md5)(generateImei()).toString("hex").substring(8, 24)}`,
        incremental: `${randstr(10, true)}`,
        "--end--": "修改后可能需要重新验证设备。"
    };
}
exports.generateShortDevice = generateShortDevice;
/** 生成完整设备信息 */
function generateFullDevice(apk, d) {
    if (!d)
        d = generateShortDevice();
    return {
        display: d.display,
        product: d.product,
        device: d.device,
        board: d.board,
        brand: d.brand,
        model: d.model,
        bootloader: d.bootloader,
        fingerprint: `${d.brand}/${d.product}/${d.device}:10/${d.display}/${d.incremental}:user/release-keys`,
        boot_id: d.boot_id,
        proc_version: d.proc_version,
        baseband: "",
        sim: "T-Mobile",
        os_type: "android",
        mac_address: d.mac_address,
        ip_address: d.ip_address,
        wifi_bssid: d.mac_address,
        wifi_ssid: d.wifi_ssid,
        imei: d.android_id,
        android_id: d.android_id,
        apn: "wifi",
        version: {
            incremental: d.incremental,
            release: "10",
            codename: "REL",
            sdk: 29,
        },
        imsi: (0, crypto_1.randomBytes)(16),
        guid: (0, constants_1.md5)(Buffer.concat([Buffer.from(d.android_id), Buffer.from(d.mac_address)])),
    };
}
exports.generateFullDevice = generateFullDevice;
class Device {
    constructor(apk, d) {
        this.apk = apk;
        this.secret = 'ZdJqM15EeO2zWc08';
        this.publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDEIxgwoutfwoJxcGQeedgP7FG9
qaIuS0qzfR8gWkrkTZKM2iWHn2ajQpBRZjMSoSf6+KJGvar2ORhBfpDXyVtZCKpq
LQ+FLkpncClKVIrBwv6PHyUvuCb0rIarmgDnzkfQAqVufEtR64iazGDKatvJ9y6B
9NMbHddGSAUmRTCrHQIDAQAB
-----END PUBLIC KEY-----`;
        if (!d)
            d = generateShortDevice();
        Object.assign(this, generateFullDevice(apk, d));
    }
    async getQIMEI() {
        if (this.apk.app_key === "") {
            return;
        }
        const k = (0, constants_1.randomString)(16);
        const key = (0, algo_1.encryptPKCS1)(this.publicKey, k);
        const time = Date.now();
        const nonce = (0, constants_1.randomString)(16);
        const payload = this.genRandomPayloadByDevice();
        const params = (0, algo_1.aesEncrypt)(JSON.stringify(payload), k).toString('base64');
        try {
            const { data } = await axios_1.default.post("https://snowflake.qq.com/ola/android", {
                key,
                params,
                time, nonce,
                sign: (0, constants_1.md5)(key + params + time + nonce + this.secret).toString("hex"),
                extra: ''
            }, {
                headers: {
                    'User-Agent': `Dalvik/2.1.0 (Linux; U; Android ${this.version.release}; PCRT00 Build/N2G48H)`,
                    'Content-Type': "application/json"
                }
            });
            if (data?.code !== 0) {
                return;
            }
            const { q16, q36 } = JSON.parse((0, algo_1.aesDecrypt)(data.data, k));
            this.qImei16 = q16;
            this.qImei36 = q36 || q16;
            if (this.qImei36)
                this.imsi = Buffer.from(this.qImei36, 'hex');
        }
        catch {
        }
    }
    genRandomPayloadByDevice() {
        const fixedRand = (max = 1, min = 0) => {
            if (max < min)
                [max, min] = [min, max];
            const diff = max - min;
            return Math.floor(Math.random() * diff) + min;
        };
        const reserved = {
            "harmony": "0",
            "clone": Math.random() > 0.5 ? "1" : "0",
            "containe": "",
            "oz": "",
            "oo": "",
            "kelong": Math.random() > 0.5 ? "1" : "0",
            "uptimes": (0, constants_1.formatTime)(new Date()),
            "multiUser": Math.random() > 0.5 ? "1" : "0",
            "bod": this.board,
            "brd": this.brand,
            "dv": this.device,
            "firstLevel": "",
            "manufact": this.brand,
            "name": this.model,
            "host": "se.infra",
            "kernel": this.fingerprint
        };
        const timestamp = Date.now();
        this.mtime = this.mtime || Date.now();
        const mtime1 = new Date(this.mtime || Date.now());
        const dateFormat = (fmt, time = Date.now()) => (0, constants_1.formatTime)(time, fmt);
        const mtimeStr1 = dateFormat("YYYY-mm-ddHHMMSS", mtime1) + "." + this.imei.slice(2, 11);
        const mtime2 = new Date(this.mtime - parseInt(this.imei.slice(2, 4)));
        const mtimeStr2 = dateFormat("YYYY-mm-ddHHMMSS", mtime2) + "." + this.imei.slice(5, 14);
        let beaconIdArr = [
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            mtimeStr1,
            '0000000000000000',
            (0, constants_1.md5)(this.android_id + this.imei).toString("hex").slice(0, 16),
            ...new Array(4).fill(false).map((_) => fixedRand(10000000, 1000000)),
            this.boot_id,
            '1',
            fixedRand(5, 0),
            fixedRand(5, 0),
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            fixedRand(5, 0),
            fixedRand(100, 10),
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            fixedRand(50000, 10000),
            fixedRand(100, 10),
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            mtimeStr2,
            fixedRand(10000, 1000),
            fixedRand(5, 0),
            `${dateFormat("YYYY-mm-ddHHMMSS")}.${String(((10 + parseInt(this.imei.slice(5, 7))) % 100)).padStart(2, "0")}0000000`,
            `${dateFormat("YYYY-mm-ddHHMMSS")}.${String(((11 + parseInt(this.imei.slice(5, 7))) % 100)).padStart(2, "0")}0000000`,
            fixedRand(10000, 1000),
            fixedRand(100, 10),
            `${dateFormat("YYYY-mm-ddHHMMSS")}.${String(((11 + parseInt(this.imei.slice(5, 7))) % 100)).padStart(2, "0")}0000000`,
            `${dateFormat("YYYY-mm-ddHHMMSS")}.${String(((11 + parseInt(this.imei.slice(5, 7))) % 100)).padStart(2, "0")}0000000`,
            fixedRand(10000, 1000),
            fixedRand(5, 0),
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            fixedRand(5, 0),
            fixedRand(100, 10),
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            `${(0, constants_1.formatTime)(new Date(timestamp + fixedRand(60, 0)))}.${String(fixedRand(99, 0)).padStart(2, '0')}0000000`,
            fixedRand(5, 0),
            fixedRand(5, 0),
        ].map((str, idx) => `k${idx + 1}:${str}`);
        return {
            "androidId": this.android_id,
            "platformId": 1,
            "appKey": this.apk.app_key,
            "appVersion": this.apk.version,
            "beaconIdSrc": beaconIdArr.join(';'),
            "brand": this.brand,
            "channelId": "2017",
            "cid": "",
            "imei": this.imei,
            "imsi": this.imsi.toString('hex'),
            "mac": this.mac_address,
            "model": this.model,
            "networkType": "unknown",
            "oaid": "",
            "osVersion": `Android ${this.version.release},level ${this.version.sdk}`,
            "qimei": "",
            "qimei36": "",
            "sdkVersion": "1.2.13.6",
            "targetSdkVersion": "26",
            "audit": "",
            "userId": "{}",
            "packageId": this.apk.id,
            "deviceType": this.display,
            "sdkName": "",
            "reserved": JSON.stringify(reserved),
        };
    }
}
exports.Device = Device;
/**
 * 支持的登录设备平台
 * * `aPad`和`Watch`协议无法设置在线状态、无法接收某些群事件（包括戳一戳等）
 * * 目前仅`Watch`支持扫码登录，可能会支持`iPad`扫码登录
 */
var Platform;
(function (Platform) {
    /** 安卓手机 */
    Platform[Platform["Android"] = 1] = "Android";
    /** 安卓平板 */
    Platform[Platform["aPad"] = 2] = "aPad";
    /** 安卓手表 */
    Platform[Platform["Watch"] = 3] = "Watch";
    /** MacOS */
    Platform[Platform["iMac"] = 4] = "iMac";
    /** iPad */
    Platform[Platform["iPad"] = 5] = "iPad";
    /** Tim */
    Platform[Platform["Tim"] = 6] = "Tim";
})(Platform || (exports.Platform = Platform = {}));
const mobile = [
    // 每个版本不同的信息
    {
        name: "A9.1.65.5017700a",
        version: "9.1.65.24795",
        ver: "9.1.65",
        subid: 537278302,
        apad_subid: 537278341,
        qua: "V1_AND_SQ_9.1.65_9558_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2570",
        buildtime: 0x67e3b10a,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.60.045f5d19",
        version: "9.1.60.24370",
        ver: "9.1.60",
        subid: 537275636,
        apad_subid: 537275675,
        qua: "V1_AND_SQ_9.1.60_9388_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2568",
        buildtime: 0x67bdac68,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
         name: "A9.1.55.464b50b2",
         version: "9.1.55.23945",
         ver: "9.1.55",
         subid: 537272835,
         apad_subid: 537272874,
         qua: "V1_AND_SQ_9.1.55_9218_YYB_D",
         channel: "GuanWang",
         sdkver: "6.0.0.2568",
         buildtime: 0x67bdac68,
         bitmap: 0x08f7ff7c,
         ssover: 0x16,
     },
     {
        name: "A9.1.52.b97ab15e",
        version: "9.1.52.23535",
        ver: "9.1.52",
        subid: 537270265,
        apad_subid: 537270304,
        qua: "V1_AND_SQ_9.1.52_9054_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2566",
        buildtime: 0x678f7fb7,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.50.83cc325e",
        version: "9.1.50.23520",
        ver: "9.1.50",
        subid: 537270031,
        apad_subid: 537270070,
        qua: "V1_AND_SQ_9.1.50_9048_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2566",
        buildtime: 0x678f7fb7,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.35.9f1a1697",
        version: "9.1.35.22670",
        ver: "9.1.35",
        subid: 537265576,
        apad_subid: 537265615,
        qua: "V1_AND_SQ_9.1.35_8708_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.31.cb8cd007",
        version: "9.1.31.22255",
        ver: "9.1.31",
        subid: 537262715,
        apad_subid: 537262754,
        qua: "V1_AND_SQ_9.1.31_8542_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.30.a920c625",
        version: "9.1.30.22245",
        ver: "9.1.30",
        subid: 537262559,
        apad_subid: 537262598,
        qua: "V1_AND_SQ_9.1.30_8538_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.25.008c1bb3",
        version: "9.1.25.21820",
        ver: "9.1.25",
        subid: 537260030,
        apad_subid: 537260069,
        qua: "V1_AND_SQ_9.1.25_8368_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.20.fa404fa6",
        version: "9.1.20.21395",
        ver: "9.1.20",
        subid: 537257414,
        apad_subid: 537257453,
        qua: "V1_AND_SQ_9.1.20_8198_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.16.3fe73575",
        version: "9.1.16.20980",
        ver: "9.1.16",
        subid: 537254305,
        apad_subid: 537254344,
        qua: "V1_AND_SQ_9.1.16_8032_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.15.25851cef",
        version: "9.1.15.20970",
        ver: "9.1.15",
        subid: 537254149,
        apad_subid: 537254188,
        qua: "V1_AND_SQ_9.1.15_8028_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.10.2ce90365",
        version: "9.1.10.20545",
        ver: "9.1.10",
        subid: 537251380,
        apad_subid: 537251419,
        qua: "V1_AND_SQ_9.1.10_7858_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.5.468dd2ea",
        version: "9.1.5.20120",
        ver: "9.1.5",
        subid: 537247779,
        apad_subid: 537247818,
        qua: "V1_AND_SQ_9.1.5_7688_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2565",
        buildtime: 0x6705241d,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.1.0.2129b4e8",
        version: "9.1.0.19695",
        ver: "9.1.0",
        subid: 537244893,
        apad_subid: 537244932,
        qua: "V1_AND_SQ_9.1.0_7518_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2564",
        buildtime: 0x66cd4b59,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
        name: "A9.0.95.705d26da",
        version: "9.0.95.19320",
        ver: "9.0.95",
        subid: 537242075,
        apad_subid: 537242114,
        qua: "V1_AND_SQ_9.0.95_7368_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2563",
        buildtime: 0x66c6f015,
        bitmap: 0x08f7ff7c,
        ssover: 0x16,
    },
    {
      name: "A9.0.90.38ae7504",
      version: "9.0.90.18945",
      ver: "9.0.90",
      subid: 537239255,
      apad_subid: 537239294,
      qua: "V1_AND_SQ_9.0.90_7218_YYB_D",
      channel: "GuanWang",
      sdkver: "6.0.0.2561",
      buildtime: 1718353600,
      bitmap: 150470524,
      ssover: 21,
    },
    {
      name: "A9.0.85.491c232e",
      version: "9.0.85.18570",
      ver: "9.0.85",
      subid: 537236316,
      apad_subid: 537236355,
      qua: "V1_AND_SQ_9.0.85_7068_YYB_D",
      channel: "GuanWang",
      sdkver: "6.0.0.2561",
      buildtime: 1718353600,
      bitmap: 150470524,
      ssover: 21,
    },
    {
      name: "A9.0.81.3daf0e38",
      version: "9.0.81.18205",
      ver: "9.0.81",
      subid: 537233527,
      apad_subid: 537233566,
      qua: "V1_AND_SQ_9.0.81_6922_YYB_D",
      channel: "GuanWang",
      sdkver: "6.0.0.2561",
      buildtime: 1718353600,
      bitmap: 150470524,
      ssover: 21,
    },
    {
      name: "A9.0.80.0d6f99ed",
      version: "9.0.80.18195",
      ver: "9.0.80",
      subid: 537233371,
      apad_subid: 537233410,
      qua: "V1_AND_SQ_9.0.80_6918_YYB_D",
      channel: "GuanWang",
      sdkver: "6.0.0.2561",
      buildtime: 1718353600,
      bitmap: 150470524,
      ssover: 21,
    },
    {
        name: "A9.0.75.c0dc0382",
        version: "9.0.75.17920",
        ver: "9.0.75",
        subid: 537230737,
        apad_subid: 537230776,
        qua: "V1_AND_SQ_9.0.75_6808_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2561",
        buildtime: 0x666bfec0,
        bitmap: 0x08f7ff7c,
        ssover: 0x15,
    },
    {
        name: "A9.0.71.e2f45246",
        version: "9.0.71.17655",
        ver: "9.0.71",
        subid: 537228643,
        apad_subid: 537228682,
        qua: "V1_AND_SQ_9.0.71_6702_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2561",
        buildtime: 0x666bfec0,
        bitmap: 0x08f7ff7c,
        ssover: 0x15,
    },
    {
        name: "A9.0.70.e4b76fcc",
        version: "9.0.70.17645",
        ver: "9.0.70",
        subid: 537228487,
        apad_subid: 537228526,
        qua: "V1_AND_SQ_9.0.70_6698_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2561",
        buildtime: 0x666bfec0,
        bitmap: 0x08f7ff7c,
        ssover: 0x15,
    },
    {
        name: "A9.0.65.530ce28d",
        version: "9.0.65.17370",
        ver: "9.0.65",
        subid: 537225139,
        apad_subid: 537225178,
        qua: "V1_AND_SQ_9.0.65_6588_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2560",
        buildtime: 0x6620c7e5,
        bitmap: 150470524,
        ssover: 21,
    },
    {
        name: "A9.0.60.c5f71993",
        version: "9.0.60.17095",
        ver: "9.0.60",
        subid: 537222797,
        apad_subid: 537222836,
        qua: "V1_AND_SQ_9.0.60_6478_YYB_D",
        channel: "GuanWang",
        sdkver: "6.0.0.2560",
        buildtime: 0x6620c7e5,
        bitmap: 150470524,
        ssover: 21,
    },
    {
        name: "A9.0.56.c25547f8",
        version: "9.0.56.16830",
        ver: "9.0.56",
        subid: 537220323,
        apad_subid: 537220362,
        qua: 'V1_AND_SQ_9.0.56_6372_YYB_D',
        sdkver: "6.0.0.2560",
        buildtime: 0x6620c7e5,
        bitmap: 150470524,
        ssover: 21,
    },
    {
        name: "A9.0.55.54f52314",
        version: "9.0.55.16820",
        ver: "9.0.55",
        buildtime: 1713424357,
        subid: 537220167,
        apad_subid: 537220206,
        bitmap: 150470524,
        sdkver: "6.0.0.2560",
        qua: 'V1_AND_SQ_9.0.55_6368_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.50.a9d8c8dc",
        version: "9.0.50.16545",
        ver: "9.0.50",
        buildtime: 1710769234,
        subid: 537217916,
        apad_subid: 537217955,
        bitmap: 150470524,
        sdkver: "6.0.0.2559",
        qua: 'V1_AND_SQ_9.0.50_6258_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.35.52ab3f26",
        version: "9.0.35.16275",
        ver: "9.0.35",
        buildtime: 1710769234,
        subid: 537215475,
        apad_subid: 537215514,
        bitmap: 150470524,
        sdkver: "6.0.0.2559",
        qua: 'V1_AND_SQ_9.0.35_6150_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.35.50c16765",
        version: "9.0.35.16270",
        ver: "9.0.35",
        buildtime: 1710769234,
        subid: 537215397,
        apad_subid: 537215436,
        bitmap: 150470524,
        sdkver: "6.0.0.2559",
        qua: 'V1_AND_SQ_9.0.35_6148_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.30.47d3bd6c",
        version: "9.0.30.15995",
        ver: "9.0.30",
        buildtime: 1710769234,
        subid: 537211926,
        apad_subid: 537211965,
        bitmap: 150470524,
        sdkver: "6.0.0.2559",
        qua: 'V1_AND_SQ_9.0.30_6038_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.25.63b29b33",
        version: "9.0.25.15760",
        ver: "9.0.25",
        buildtime: 1702888273,
        subid: 537210084,
        apad_subid: 537210123,
        bitmap: 150470524,
        sdkver: "6.0.0.2558",
        qua: 'V1_AND_SQ_9.0.25_5942_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.25.e1f154c9",
        version: "9.0.25.15735",
        ver: "9.0.25",
        buildtime: 1702888273,
        subid: 537210006,
        apad_subid: 537210045,
        bitmap: 150470524,
        sdkver: "6.0.0.2558",
        qua: 'V1_AND_SQ_9.0.25_5932_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.20.38faf5bf",
        version: "9.0.20.15515",
        ver: "9.0.20",
        buildtime: 1702888273,
        subid: 537206436,
        apad_subid: 537206475,
        bitmap: 150470524,
        sdkver: "6.0.0.2558",
        qua: 'V1_AND_SQ_9.0.20_5844_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.17.6a4a36ca",
        version: "9.0.17.15185",
        ver: "9.0.17",
        buildtime: 1702888273,
        subid: 537204056,
        apad_subid: 537204095,
        bitmap: 150470524,
        sdkver: "6.0.0.2558",
        qua: 'V1_AND_SQ_9.0.17_5712_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.15.4145f774",
        version: "9.0.15.14970",
        ver: "9.0.15",
        buildtime: 1702888273,
        subid: 537202216,
        apad_subid: 537202255,
        bitmap: 150470524,
        sdkver: "6.0.0.2558",
        qua: 'V1_AND_SQ_9.0.15_5626_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.8.10368491",
        version: "9.0.8.14755",
        ver: "9.0.8",
        buildtime: 1702888273,
        subid: 537200218,
        apad_subid: 537200257,
        bitmap: 150470524,
        sdkver: "6.0.0.2558",
        qua: 'V1_AND_SQ_9.0.8_5540_YYB_D',
        ssover: 21,
    },
    {
        name: "A9.0.0.0ebb1ecb",
        version: "9.0.0.14110",
        ver: "9.0.0",
        buildtime: 1701164403,
        subid: 537194351,
        apad_subid: 537194390,
        bitmap: 150470524,
        sdkver: "6.0.0.2557",
        qua: 'V1_AND_SQ_9.0.0_5282_YYB_D',
        ssover: 21,
    },
    {
        name: "A8.9.93.bf80f08f",
        version: "8.9.93.13475",
        ver: "8.9.93",
        buildtime: 1697015435,
        subid: 537187398,
        apad_subid: 537187437,
        bitmap: 150470524,
        sdkver: "6.0.0.2556",
        qua: 'V1_AND_SQ_8.9.93_5028_YYB_D',
        ssover: 21,
    },
    {
        name: "A8.9.90.cccfa0d0",
        version: "8.9.90.13250",
        ver: "8.9.90",
        buildtime: 1697015435,
        subid: 537185007,
        apad_subid: 537185046,
        bitmap: 150470524,
        sdkver: "6.0.0.2556",
        qua: 'V1_AND_SQ_8.9.90_4938_YYB_D',
        ssover: 21,
    },
    {
        name: "A8.9.88.46a07457",
        version: "8.9.88.13035",
        ver: "8.9.88",
        buildtime: 1697015435,
        subid: 537182769,
        apad_subid: 537182808,
        bitmap: 150470524,
        sdkver: "6.0.0.2556",
        qua: 'V1_AND_SQ_8.9.88_4852_YYB_D',
        ssover: 21,
    },
    {
        name: "A8.9.85.3377f9bf",
        version: "8.9.85.12820",
        ver: "8.9.85",
        buildtime: 1697015435,
        subid: 537180568,
        apad_subid: 537180607,
        bitmap: 150470524,
        sdkver: "6.0.0.2556",
        qua: 'V1_AND_SQ_8.9.85_4766_YYB_D',
        ssover: 21,
    },
    {
        name: "A8.9.83.c9a61e5e",
        version: "8.9.83.12605",
        ver: "8.9.83",
        buildtime: 1691565978,
        subid: 537178646,
        apad_subid: 537178685,
        bitmap: 150470524,
        sdkver: "6.0.0.2554",
        qua: 'V1_AND_SQ_8.9.83_4680_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.80.57a42f50",
        version: "8.9.80.12440",
        ver: "8.9.80",
        buildtime: 1691565978,
        subid: 537176863,
        apad_subid: 537176902,
        bitmap: 150470524,
        sdkver: "6.0.0.2554",
        qua: 'V1_AND_SQ_8.9.80_4614_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.78.d5d9d71d",
        version: "8.9.78.12275",
        ver: "8.9.78",
        buildtime: 1691565978,
        subid: 537175315,
        apad_subid: 537175354,
        bitmap: 150470524,
        sdkver: "6.0.0.2554",
        qua: 'V1_AND_SQ_8.9.78_4548_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.76.c71a1fa8",
        version: "8.9.76.12115",
        ver: "8.9.76",
        buildtime: 1691565978,
        subid: 537173477,
        apad_subid: 537173525,
        bitmap: 150470524,
        sdkver: "6.0.0.2554",
        qua: 'V1_AND_SQ_8.9.76_4484_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.75.354d41fc",
        version: "8.9.75.12110",
        ver: "8.9.75",
        buildtime: 1691565978,
        subid: 537173381,
        apad_subid: 537173429,
        bitmap: 150470524,
        sdkver: "6.0.0.2554",
        qua: 'V1_AND_SQ_8.9.75_4482_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.73.11945",
        version: "8.9.73.11945",
        ver: "8.9.73",
        buildtime: 1690371091,
        subid: 537171689,
        apad_subid: 537171737,
        bitmap: 150470524,
        sdkver: "6.0.0.2553",
        qua: 'V1_AND_SQ_8.9.73_4416_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.71.9fd08ae5",
        version: "8.9.71.11735",
        ver: "8.9.71",
        buildtime: 1688720082,
        subid: 537170024,
        apad_subid: 537170072,
        bitmap: 150470524,
        sdkver: "6.0.0.2551",
        qua: 'V1_AND_SQ_8.9.71_4332_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.70.b4332bd3",
        version: "8.9.70.11730",
        ver: "8.9.70",
        buildtime: 1688720082,
        subid: 537169928,
        apad_subid: 537169976,
        bitmap: 150470524,
        sdkver: "6.0.0.2551",
        qua: 'V1_AND_SQ_8.9.70_4330_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.68.e757227e",
        version: "8.9.68.11565",
        ver: "8.9.68",
        buildtime: 1687254022,
        subid: 537168313,
        apad_subid: 537168361,
        bitmap: 150470524,
        sdkver: "6.0.0.2549",
        qua: 'V1_AND_SQ_8.9.68_4264_YYB_D',
        ssover: 20,
    },
    {
        name: "A8.9.63.5156de84",
        version: "8.9.63.11390",
        ver: "8.9.63",
        buildtime: 1685069178,
        subid: 537164840,
        apad_subid: 537164888,
        bitmap: 150470524,
        sdkver: "6.0.0.2546",
        qua: 'V1_AND_SQ_8.9.63_4194_YYB_D',
        ssover: 20,
    }
].map((shortInfo) => {
    // 固定信息
    return {
        id: "com.tencent.mobileqq",
        appid: 16,
        app_key: '0S200MNJT807V3GE',
        sign: Buffer.from('A6 B7 45 BF 24 A2 C2 77 52 77 16 F6 F3 6E B6 8D'.split(' ').map(s => parseInt(s, 16))),
        main_sig_map: 16724722,
        sub_sig_map: 66560,
        display: "Android",
        device_type: 3,
        ...shortInfo
    };
});
const tim = [
    // 每个版本不同的信息
    {
        name: "A3.5.6.b80635c4",
        version: "3.5.6.3208",
        ver: "3.5.6",
        buildtime: 1630062176,
        subid: 537181169,
        bitmap: 150470524,
        sdkver: "6.0.0.2484",
        qua: "V1_AND_SQ_8.3.9_356_TIM_D",
        ssover: 18,
    },
    {
        name: "A3.5.5.fa2ef27c",
        version: "3.5.5.3198",
        ver: "3.5.5",
        buildtime: 1630062176,
        subid: 537177451,
        bitmap: 150470524,
        sdkver: "6.0.0.2484",
        qua: "V1_AND_SQ_8.3.9_355_TIM_D",
        ssover: 18,
    },
    {
        name: "A3.5.2.3f4af297",
        version: "3.5.2.3178",
        ver: "3.5.2",
        buildtime: 1630062176,
        subid: 537162286,
        bitmap: 150470524,
        sdkver: "6.0.0.2484",
        qua: "V1_AND_SQ_8.3.9_352_TIM_D",
        ssover: 18,
    },
    {
        name: "A3.5.1.db08e878",
        version: "3.5.1.3168",
        ver: "3.5.1",
        buildtime: 1630062176,
        subid: 537150355,
        bitmap: 150470524,
        sdkver: "6.0.0.2484",
        qua: "V1_AND_SQ_8.3.9_351_TIM_D",
        ssover: 18,
    }
].map((shortInfo) => {
    // 固定信息
    return {
        id: "com.tencent.tim",
        app_key: '0S200MNJT807V3GE',
        sign: Buffer.from('775e696d09856872fdd8ab4f3f06b1e0', 'hex'),
        appid: 16,
        main_sig_map: 16724722,
        sub_sig_map: 0x10400,
        display: "Tim",
        device_type: -1,
        ...shortInfo
    };
});
const watch = [
    {
        name: "A2.0.8",
        version: "2.0.8",
        ver: "2.0.8",
        buildtime: 1559564731,
        subid: 537065138,
        bitmap: 16252796,
        sdkver: "6.0.0.2365",
        qua: '',
        ssover: 5
    },
    {
        name: "A2.1.7",
        version: "2.1.7",
        ver: "2.1.7",
        buildtime: 1654570540,
        subid: 537140974,
        bitmap: 16252796,
        sdkver: "6.0.0.2366",
        qua: 'V1_WAT_SQ_2.1.7_002_IDC_B',
        ssover: 5
    }
].map((shortInfo) => {
    // 固定信息
    return {
        id: "com.tencent.qqlite",
        app_key: '0S200MNJT807V3GE',
        sign: Buffer.from('A6 B7 45 BF 24 A2 C2 77 52 77 16 F6 F3 6E B6 8D'.split(' ').map(s => parseInt(s, 16))),
        appid: 16,
        main_sig_map: 16724722,
        sub_sig_map: 0x10400,
        display: "Watch",
        device_type: 8,
        ...shortInfo
    };
});
const hd = {
    id: "com.tencent.qq",
    app_key: '0S200MNJT807V3GE',
    name: "A6.8.2.21241",
    version: "6.8.2.21241",
    ver: "6.8.2",
    sign: Buffer.from('AA 39 78 F4 1F D9 6F F9 91 4A 66 9E 18 64 74 C7'.split(' ').map(s => parseInt(s, 16))),
    buildtime: 1647227495,
    appid: 16,
    subid: 537128930,
    bitmap: 150470524,
    main_sig_map: 1970400,
    sub_sig_map: 66560,
    sdkver: "6.2.0.1023",
    display: "iMac",
    device_type: 5,
    qua: '',
    ssover: 12
};
const apklist = {
    [Platform.Android]: mobile,
    [Platform.Tim]: tim,
    [Platform.aPad]: mobile.map(apk => {
        return {
            ...apk,
            subid: apk?.apad_subid || apk.subid,
            display: 'aPad'
        };
    }),
    [Platform.Watch]: watch,
    [Platform.iMac]: { ...hd },
    [Platform.iPad]: {
        ...mobile[0],
        subid: 537155074,
        sign: hd.sign,
        name: '8.9.50.611',
        version: '8.9.50.611',
        ver: '8.9.50',
        sdkver: '6.0.0.2535',
        qua: '',
        display: 'iPad',
        ssover: 19
    },
};
function getApkInfoList(p) {
    const apks = apklist[p];
    if (!Array.isArray(apks))
        return [apks];
    return apks;
}
exports.getApkInfoList = getApkInfoList;
