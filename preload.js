const cp = require('child_process')
const fs = require('fs');
const path = require('path');

const REG64STEAMPATH = "HKEY_LOCAL_MACHINE\\SOFTWARE\\Wow6432Node\\Valve\\Steam"
const REG32STEAMPATH = "HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam"

const URL_STEAMRUN = "steam://rungameid/"
const IDBLACKLIST = ['228980']

let appListCache = []

function GetSteamPath() {
    let command = "REG QUERY "
    let regex = /^\s+InstallPath\s+REG_SZ\s+(.*)$/m

    let r = ""
    let res = ""

    // Try 64-bit Reg Query
    try {
        r = cp.execSync(command + REG64STEAMPATH).toString()
        res = regex.exec(r)
        if (res) {
            return res[1];
        }
    }
    catch (err) {
        // console.error(err);
    }

    // Try 32-bit Reg Query
    try {
        r = cp.execSync(command + REG32STEAMPATH).toString()
        res = regex.exec(r)
        if (res) {
            return res[1];
        }
    }
    catch (err) {
        // console.error(err)
    }

    // Cannot find steam
    return null;
}

function GetSteamAppsList() {
    let steamPath = GetSteamPath()
    if (!steamPath) {
        return [{ title: '无法找到Steam', description: 'Steam或许未被正常安装', url: '' }]
    }
    else {
        let appList = []
        let appidRegex = /"appid"\s+"([0-9]+)"$/m
        let appnameRegex = /"name"\s+"(.+)"$/m

        let steamAppsPathList = [steamPath + "\\steamapps"]

        // 查找其他的Library
        let libraryRegex = /^\s+"[0-9]+"\s+"(.+)"$/gm
        let content = fs.readFileSync(path.join(steamAppsPathList[0], "libraryfolders.vdf")).toString()
        try {
            let res = libraryRegex.exec(content)
            while (res) {
                let rawPath = res[1]
                steamAppsPathList.push(rawPath.replace("\\\\", "\\") + "\\steamapps")
                res = libraryRegex.exec(content)
            }
        }
        catch (err) {
            console.error("Unable to solve library: " + file)
        }

        for (let i in steamAppsPathList) {
            steamAppsPath = steamAppsPathList[i]
            let fileList = fs.readdirSync(steamAppsPath)
            for (let j in fileList) {
                file = fileList[j]
                let extname = path.extname(file)
                if (extname == ".acf") {
                    let content = fs.readFileSync(path.join(steamAppsPath, file)).toString()
                    try {
                        let appid = appidRegex.exec(content)[1]

                        // appid是否在黑名单
                        if (IDBLACKLIST.includes(appid))
                            continue;

                        let appname = appnameRegex.exec(content)[1]
                        appList.push({ title: appname, description: appid, url: URL_STEAMRUN + appid, lowtitle: appname.toLowerCase() })
                    }
                    catch (err) {
                        console.error("Unable to solve game:" + file)
                    }
                }
            }
        }
        return appList;
    }
}

function CacheCheck() {
    // 无缓冲列表 或者 第一个url为空
    if (appListCache.length == 0 || !appListCache[0].url) {
        appListCache = GetSteamAppsList()
    }
}

function GetFilteredAppsList(word) {

    if (!word) return appListCache

    word = word.toLowerCase()
    let resultList = []
    for (let j in appListCache) {
        e = appListCache[j]
        let lastIndex = -1
        let lowtitle = e.lowtitle
        let charList = word.split("")
        let isMatch = true
        let matchScore = 0  // Higher score stands for lower relevant
        for (let i in charList) {
            char = charList[i]
            let nowIndex = lowtitle.indexOf(char, lastIndex + 1)
            if (nowIndex == -1) {
                isMatch = false
                break
            }
            else {
                if (nowIndex != 0) {
                    let prevChar = lowtitle[nowIndex - 1]
                    let alphaRegex = /^[a-z0-9]$/
                    if (alphaRegex.test(prevChar))
                        matchScore += nowIndex - lastIndex - 1
                }
                lastIndex = nowIndex
            }
        }

        if (isMatch) {
            e.matchScore = matchScore
            resultList.push(e)
        }
    }
    return resultList.sort((a, b) => a.matchScore - b.matchScore)
}

window.exports = {
    "select_apps": {
        mode: "list",
        args: {
            enter: (action, callbackSetList) => {
                CacheCheck()
                callbackSetList(appListCache)
            },
            search: (action, searchWord, callbackSetList) => {
                CacheCheck()
                callbackSetList(GetFilteredAppsList(searchWord))
            },
            select: (action, itemData) => {
                window.utools.hideMainWindow()
                let url = itemData.url
                window.utools.shellOpenExternal(url)
                appListCache = []
                window.utools.outPlugin()
            },
            placeholder: "搜索应用名"
        }
    }
}