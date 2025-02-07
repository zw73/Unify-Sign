let { config } = require('../config.js')(runtime, this)
config.async_save_log_file = false
let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, this)
let { logInfo, errorInfo, warnInfo, debugInfo, infoLog, debugForDev, clearLogFile, flushAllLogs } = singletonRequire('LogUtils')
let runningQueueDispatcher = singletonRequire('RunningQueueDispatcher')
logInfo('======加入任务队列，并关闭重复运行的脚本=======')
runningQueueDispatcher.addRunningTask()

let localOcrUtil = require('../lib/LocalOcrUtil.js')
let OpenCvUtil = require('../lib/OpenCvUtil.js')
let WarningFloaty = singletonRequire('WarningFloaty')

let FloatyInstance = singletonRequire('FloatyUtil')
FloatyInstance.init()
FloatyInstance.enableLog()
config.not_lingering_float_window = true

let commonFunctions = singletonRequire('CommonFunction')
commonFunctions.killDuplicateScript()
let widgetUtils = singletonRequire('WidgetUtils')
let automator = singletonRequire('Automator')

let callStateListener = !config.is_pro && config.enable_call_state_control ? singletonRequire('CallStateListener') : { exitIfNotIdle: () => { } }
let resourceMonitor = require('../lib/ResourceMonitor.js')(runtime, this)
let BBFarmRunner = require('../core/BBFarm.js')
let unlocker = require('../lib/Unlock.js')

let actionBtns = {}
let nextRunTime = 0
let startTimestamp = new Date().getTime()

function setupNextRunTime (delay) {
  nextRunTime = nextRunTime==0 ? delay : Math.min(delay,nextRunTime)
}

// 注册自动移除运行中任务
commonFunctions.registerOnEngineRemoved(function () {
if (config.auto_lock === true && unlocker.needRelock() === true) {
  debugInfo('重新锁定屏幕')
  automator.lockScreen()
  unlocker.saveNeedRelock(true)
}
  config.resetBrightness && config.resetBrightness()
  debugInfo('校验并移除已加载的dex')
  // 移除运行中任务
  runningQueueDispatcher.removeRunningTask(true, false, () => {
    // 保存是否需要重新锁屏
    unlocker.saveNeedRelock()
    config.isRunning = false
  })
}, 'mengxiaoyuan')

callStateListener.exitIfNotIdle()
if (!commonFunctions.ensureAccessibilityEnabled()) {
  errorInfo('获取无障碍权限失败')
  exit()
}

unlocker.exec()

//commonFunctions.showCommonDialogAndWait('萌小院领免费资源')
commonFunctions.listenDelayStart()
commonFunctions.requestScreenCaptureOrRestart(true)

/* 去掉检查是否自动任务
//检查是否是自动任务
let isAutoTask = false
let array = commonFunctions.getFullTimeRuntimeStorage('timerAutoStart').array || []
if (array && array.length > 0) {
  debugInfo(['当前已注册的定时任务：{}', JSON.stringify(array)])
  let mainScriptJs = commonFunctions.getRunningScriptSource()
  debugInfo(['当前执行脚本: {}', mainScriptJs])
  //查找是否有当前脚本任务正在执行
  for (let task of array) {
    if (task.mScriptPath === mainScriptJs && task.mMillis <= new Date().getTime()) {
      debugInfo('找到自动任务：' + JSON.stringify(task))
      isAutoTask = true
      break
    }
  }
}
*/

// 执行领免费资源
exec()

if (nextRunTime!=0) {
  commonFunctions.setUpAutoStart(nextRunTime)
}

commonFunctions.minimize()

runningQueueDispatcher.removeRunningTask(true)
exit()

//完成浏览任务
function doBrowseTask() {
  sleep(5000)

  debugInfo('通过关闭按钮来确定进入浏览界面')
  let closeBtn = null
  let limit = 5
  while (limit-- > 0) {
    closeBtn = captureAndCheckByOcr('^关闭$','关闭按钮',[config.device_width/2,0,config.device_width/2,500],null,null,1)
    if (closeBtn) {
      break
    }
    sleep(1000)
  }
  if (!closeBtn) {
    debugInfo('未找到关闭按钮，可能是免费直接领')
    return false
  }
  
  LogFloaty.pushLog(' 等待倒计时结束')
  limit = 30
  let isFinish = null
  while (limit-- > 0) {
    sleep(1000)
    LogFloaty.replaceLastLog(' 等待倒计时结束 剩余：' + limit + 's')
    if (limit % 2 == 0) {
      automator.scrollUpAndDown(800)
      isFinish = captureAndCheckByOcr('已获得奖励','已获得奖励',[0,0,config.device_width/2,500],null,null,1)
      if (isFinish) {
        break
      }
    }
  }
  debugInfo('浏览任务完成，点击关闭按钮')
  automator.clickRandom(closeBtn)
  sleep(8000)
  FloatyInstance.hide()
  return !!isFinish
}

//领取所有免费奖励
function getFreeResource (region) {
  let repeat = 0
  let taskFinished = true
  let exitRun = false

  while (repeat<5 && !exitRun) {
    //OCR识别所有“免费”文字并点击
    let freeTexts = null
    // 领取当前所有免费商品
    do {
      if (new Date().getTime() - startTimestamp > 600000) {
        debugInfo('运行时间超过10分钟，先退出完成其他任务，一分钟后继续')
        exitRun = true
        setupNextRunTime(1)
        break
      }
    
      freeTexts = localOcrUtil.recognizeWithBounds(commonFunctions.captureScreen(), region, '^.*免费|.*免费\\(\\d/\\d\\)$')
      if (freeTexts && freeTexts.length > 0) {
        taskFinished = false
        WarningFloaty.clearAll()
        let freeText = freeTexts[0]
        debugInfo(['OCR找到了免费文字：{}', freeText.label])
        let collect = freeText.bounds
        WarningFloaty.addRectangle(freeText.label, boundsToRegion(collect))
  
        automator.clickPointRandom(collect.centerX(), collect.centerY())
        sleep(1000)
  
        doBrowseTask()

        let getBtn = captureAndCheckByOcr('^领取$','领取按钮',null,null,null,1)
        if (getBtn) {
          automator.clickRandom(getBtn)
        }
        sleep(5000)
      } else {
        debugInfo('未找到收集按钮')
      }
      WarningFloaty.clearAll()
    } while (freeTexts && freeTexts.length > 0)
      
    if (!exitRun) {
      // 免费刷新
      freeTexts = localOcrUtil.recognizeWithBounds(commonFunctions.captureScreen(), region, '^.*免费刷新$')
      if (freeTexts && freeTexts.length > 0) {
        taskFinished = false
        WarningFloaty.clearAll()
        let freeText = freeTexts[0]
        debugInfo(['OCR找到了：{}', freeText.label])
        let collect = freeText.bounds
        WarningFloaty.addRectangle(freeText.label, boundsToRegion(collect))
    
        automator.clickPointRandom(collect.centerX(), collect.centerY())
        sleep(1000)
    
        doBrowseTask()

      } else {
        debugInfo('未找到免费刷新按钮')
        //判断是否有倒计时，获取倒计时结束时间
        let countDowns = localOcrUtil.recognizeWithBounds(commonFunctions.captureScreen(), region, '^\\d{2}:\\d{2}$')
        if (countDowns && countDowns.length > 0) {
          taskFinished = false
          countDowns.forEach(function (countDown) {
            let countDownText = countDown.label
            debugInfo(['OCR找到了倒计时：{}', countDownText])
            let countDownTime = parseInt(/(\d{2}):\d{2}/.exec(countDownText)[1])+1
            setupNextRunTime(countDownTime)
          })
        }
        //滑动到下一屏继续寻找
        //20250207 关闭滑动避免收取无用杂物，提升效率
        // automator.gestureDown(region[1]+region[3]-200,region[1]+200,3000)
        // sleep(3000)
        // repeat++
        break
      }
    }
    WarningFloaty.clearAll()
  }
  if (!exitRun && taskFinished) {
    LogFloaty.pushLog('领取免费资源完成')
    commonFunctions.setFreeResourceCollected()
  }
}

function enterMengxiaoYuan () {
  let entryBtn = widgetUtils.widgetGetOne('萌小院', 5000)
  if (entryBtn) {
    sleep(5000)
    debugInfo(['点击萌小院入口'])
    automator.clickRandom(entryBtn.parent().parent())
    //等待进入并跳过启动弹窗
    commonFunctions.waitForAction(20,'进入萌小院',function () {
      return captureAndCheckByOcr('小店', '萌小院标志',[config.device_width/2,config.device_height/2,config.device_width/2,config.device_height/2])
    })
  }
}

function closePopup() {
  let base64BtnClose = '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'
  close_btn = captureAndCheckByImg(base64BtnClose, '关闭弹窗按钮',null,null,1)
  if (close_btn) {
    let noPopupAG = captureAndCheckByOcr('.*今日内不再弹出.*', '取消弹窗选框',null,null,null,1)
    if (noPopupAG) {
      debugInfo(['点击取消弹窗选框'])
      automator.clickRandom(noPopupAG)
      sleep(1000)
    }

    debugInfo(['点击关闭按钮'])
    automator.clickRandom(close_btn)
    sleep(3000)
    return true
  } else {
    return false
  }
}

function skipPopupIfNeed() {
  debugInfo('检查是否有启动弹窗')
  let hasClose_btn = null
  let result = false
  do {
    debugInfo(['检查领取体力弹窗'])
    let getGift_btn = captureAndCheckByOcr('.*领取体力.*', '领取体力按钮')
    if (getGift_btn) {
      debugInfo(['点击领取体力按钮'])
      automator.clickRandom(getGift_btn)
      sleep(2000)
      captureAndCheckByOcr('领取', '领取按钮',null,1000,true)
      sleep(2000)
    }
    hasClose_btn = closePopup()
    result = result || hasClose_btn
  } while (hasClose_btn)
  return result
}

function openSideBar() {
  debugInfo('打开侧边栏')
  let sideBarBtn = captureAndCheckByOcr('功|能', '侧边栏按钮',[0,0,config.device_width/2,config.device_height/2])
  if (!sideBarBtn) {
    return false
  }
  automator.clickRandom(sideBarBtn)
  sleep(3000)

  let screen = commonFunctions.captureScreen()
  let btns = localOcrUtil.recognizeWithBounds(screen, [0,0,config.device_width/2,config.device_height/2], '商城|精灵|抽奖|日记|好友|装扮|勋章')
  if (btns && btns.length > 0) {
    // let btnWidth = 0
    // let btnHeight = 0
    // let btnLefts = []
    // let btnTops = []
    btns.forEach(btn => {
      debugInfo(['找到{}按钮', btn.label])
      btn.bounds.top = btn.bounds.top - 50
      switch (btn.label) {
        case '商城':
          actionBtns.shopBtn = wrapOcrPointWithBounds(btn.bounds)
          break
        case '抽奖':
          actionBtns.lotteryBtn = wrapOcrPointWithBounds(btn.bounds)
          break
        case '好友':
          actionBtns.friendBtn = wrapOcrPointWithBounds(btn.bounds)
          break
      }
    })
  }
  
  return true
}

function openShop () {
  debugInfo('打开商城并领取免费商品')
  if (!actionBtns.shopBtn) {
    debugInfo('未找到商城入口')
    setupNextRunTime(1)
    return
  }
  if (commonFunctions.checkFreeResourceCollected()) {
    debugInfo('已领取免费商品')
    // return
  }
  debugInfo(['点击商城按钮'])
  automator.clickRandom(actionBtns.shopBtn)
  sleep(2000)

  let screen = commonFunctions.captureScreen()
  let shopTexts = localOcrUtil.recognizeWithBounds(screen, [0, 0, config.device_width, config.device_height/2], '百货商城')
  if (shopTexts && shopTexts.length > 0) {
    debugInfo('找到百货商城,准备领取免费资源')
    getFreeResource([0, config.device_height/4, config.device_width, config.device_height/4*3])
    automator.clickRandom(actionBtns.backBtn)
    sleep(3000)
  } else {
    debugInfo('未找到百货商城界面')
  }
}

function openLottery () {
  debugInfo('打开抽奖并免费抽奖')
  if (!actionBtns.lotteryBtn) {
    debugInfo('未找到抽奖按钮')
    setupNextRunTime(1)
    return
  }
  debugInfo(['点击抽奖按钮'])
  automator.clickRandom(actionBtns.lotteryBtn)
  sleep(5000)
  
  if (!actionBtns.backBtn) {
    debugInfo('查找返回按钮')
    actionBtns.backBtn = captureAndCheckByOcr('返回', '返回按钮')
    if (!actionBtns.backBtn) {
      debugInfo('未找到返回按钮')
      setupNextRunTime(5)
      return
    }
  }
  
  let region = [0, config.device_height/4, config.device_width, config.device_height/4*3]
  while (true) {
    if (new Date().getTime() - startTimestamp > 600000) {
      debugInfo('运行时间超过10分钟，先退出完成其他任务，一分钟后继续')
      setupNextRunTime(1)
      break
    }
  
    if (captureAndCheckByOcr('.*剩余次数：0','抽奖完成标志')) {
      debugInfo('抽奖次数已用完')
      break
    }
    
    let screen = commonFunctions.captureScreen()
    let freeTexts = localOcrUtil.recognizeWithBounds(screen, region, '^抽奖|.*免费抽奖$')
    if (freeTexts && freeTexts.length > 0) {
      WarningFloaty.clearAll()
      let freeText = freeTexts[0]
      debugInfo(['OCR找到了免费文字：{}', freeText.label])
      let collect = freeText.bounds
      WarningFloaty.addRectangle(freeText.label, boundsToRegion(collect))
      debugInfo(['点击抽奖按钮'])
      automator.clickPointRandom(collect.centerX(), collect.centerY())
      sleep(1000)

      // if (/.+免费抽奖/.test(freeText.label)) {
        doBrowseTask()
      // }
      let getBtn = captureAndCheckByOcr('^.*倍领取$','2倍领取按钮')
      if (getBtn) {
        automator.clickRandom(getBtn)
        doBrowseTask()
      }
      getBtn = captureAndCheckByOcr('^领取$','领取按钮')
      if (getBtn) {
        automator.clickRandom(getBtn)
        sleep(3000)
      }
      WarningFloaty.clearAll()
    } else {
      debugInfo('未找到抽奖按钮')
      break
    }
  }
  
  debugInfo('进入祈愿界面')
  automator.clickPointRandom(config.device_width/4*3, config.device_height-60)
  sleep(3000)
  
  debugInfo('进行免费祈愿')
  let failCount = 0
  while (failCount<3) {
    if (new Date().getTime() - startTimestamp > 600000) {
      debugInfo('运行时间超过10分钟，先退出完成其他任务，一分钟后继续')
      setupNextRunTime(1)
      break
    }
  
    let screen = commonFunctions.captureScreen()
    let freeTexts = localOcrUtil.recognizeWithBounds(screen, region, '^.*已获得.*$')
    if (freeTexts && freeTexts.length == 10) {
      debugInfo('已获得所有祈愿奖励')
      break
    }
    
    freeTexts = localOcrUtil.recognizeWithBounds(screen, region, '^.*免费祈愿.*$')
    if (freeTexts && freeTexts.length > 0) {
      WarningFloaty.clearAll()
      let freeText = freeTexts[0]
      debugInfo(['OCR找到了免费祈愿文字：{}', freeText.label])
      let collect = freeText.bounds
      WarningFloaty.addRectangle(freeText.label, boundsToRegion(collect))
      debugInfo(['点击祈愿按钮'])
      automator.clickPointRandom(collect.centerX(), collect.centerY())
      sleep(1000)

      failCount = doBrowseTask()? 0:failCount+1

      getBtn = captureAndCheckByOcr('^领取$','领取按钮',region,null,false,1)
      if (getBtn) {
        debugInfo(['点击领取按钮'])
        automator.clickRandom(getBtn)
        sleep(3000)
      }
      WarningFloaty.clearAll()
    } else {
      debugInfo('未找到免费祈愿按钮')
      break
    }
  }  
  
  automator.clickRandom(actionBtns.backBtn)
  sleep(3000)
}

function openFriendList () {
  debugInfo('打开好友列表并领取体力')
  if (!actionBtns.friendBtn) {
    debugInfo('未找到好友按钮')
    setupNextRunTime(1)
    return
  }
  debugInfo(['点击好友按钮'])
  automator.clickRandom(actionBtns.friendBtn)
  sleep(5000)

  if (!actionBtns.backBtn) {
    debugInfo('查找返回按钮')
    actionBtns.backBtn = captureAndCheckByOcr('返回', '返回按钮')
    if (!actionBtns.backBtn) {
      debugInfo('未找到返回按钮')
      setupNextRunTime(5)
      return
    }
  }
  
  if (captureAndCheckByOcr('^剩余赠送次数[:：]0/10$','赠送完成标识',[0, config.device_height-400, config.device_width, 400],null,null,1)) {
    debugInfo('赠送次数已用完')
  } else {
    let region = [0, config.device_height/4, config.device_width, config.device_height/4*3]
    let getCount = 0
    let repeat = 0
    let minBtnY = config.device_height / 4 * 3
    let maxBtnY = config.device_height / 4
    
    // 预处理：获取第一屏小店按钮，确定滑动距离
    debugInfo('开始确定滑动距离')
    let screen = commonFunctions.captureScreen()
    let returnGiftBtns = localOcrUtil.recognizeWithBounds(screen, region, '^小店$')
    if (returnGiftBtns && returnGiftBtns.length > 0) {
      debugInfo(['找到{}个小店按钮', returnGiftBtns.length])
      returnGiftBtns.forEach(btn => {
        let y = btn.bounds.centerY()
        minBtnY = Math.min(y, minBtnY)
        maxBtnY = Math.max(y, maxBtnY)
      })
      if (minBtnY==maxBtnY) {
        minBtnY = config.device_height / 4 + 100
        maxBtnY = config.device_height / 4 * 3 - 100
      }
      debugInfo(['滑动定位：{} - {}', minBtnY, maxBtnY])
    }

    // 处理赠送按钮的函数
    let processGiftBtn = function(giftBtn, isReturnGift) {
      if (getCount >= 10) return
      
      debugInfo(['OCR找到了{}按钮：{}', isReturnGift ? '回赠' : '小店', giftBtn.label])
      WarningFloaty.addRectangle(giftBtn.label, boundsToRegion(giftBtn.bounds))
      
      if (!isReturnGift) {
        // 小店按钮需要偏移到赠送按钮位置
        giftBtn.bounds.left += 200
        giftBtn.bounds.right += 200
        WarningFloaty.addRectangle('体力', boundsToRegion(giftBtn.bounds))
      }
      
      automator.clickRandom(wrapOcrPointWithBounds(giftBtn.bounds))
      sleep(2000)
      if (captureAndCheckByOcr('^确认赠送$','确认赠送按钮',null,null,true,1)) {
        sleep(2000)
        if (captureAndCheckByOcr('^领取$', '领取按钮',null,null,true,1)) {
          sleep(2000)
          getCount++
        }
      }
      WarningFloaty.clearAll()
    }

    // 第一阶段：处理所有回赠按钮
    debugInfo('开始处理回赠按钮')
    while (repeat < 7 && getCount < 10) {
      let screen = commonFunctions.captureScreen()
      let returnGiftBtns = localOcrUtil.recognizeWithBounds(screen, region, '^回赠$')
      if (returnGiftBtns && returnGiftBtns.length > 0) {
        debugInfo(['找到{}个回赠按钮', returnGiftBtns.length])
        returnGiftBtns.forEach(btn => processGiftBtn(btn, true))
      }
      
      if (getCount >= 10) break
      
      //滑动到下一屏继续寻找
      automator.gestureDown(maxBtnY, minBtnY, 3000)
      sleep(1000)
      repeat++
    }

    // 如果还有剩余次数，处理小店按钮
    if (getCount < 10 && !captureAndCheckByOcr('^剩余赠送次数[:：]0/10$','赠送完成标识',[0, config.device_height-400, config.device_width, 400],null,null,1)) {
      debugInfo('开始处理小店按钮')
      // 回到顶部
      for (let i = 0; i < repeat; i++) {
        automator.gestureUp(minBtnY, maxBtnY, 3000)
        sleep(1000)
      }
      
      // 重置计数和坐标
      repeat = 0

      // 第二阶段：处理小店按钮
      while (repeat < 7 && getCount < 10) {
        let screen = commonFunctions.captureScreen()
        let shopBtns = localOcrUtil.recognizeWithBounds(screen, region, '^小店$')
        if (shopBtns && shopBtns.length > 0) {
          debugInfo(['找到{}个小店按钮', shopBtns.length])
          shopBtns.forEach(btn => processGiftBtn(btn, false))
        } else {
          debugInfo('未找到小店按钮')
          if (repeat >= 3) break
        }
        
        if (getCount >= 10) break
        
        //滑动到下一屏继续寻找
        automator.gestureDown(maxBtnY, minBtnY, 3000)
        sleep(1000)
        repeat++
      }
    }
  }
  
  automator.clickRandom(actionBtns.backBtn)
  sleep(3000)
}

function openGetStrengthAndCoin () {
  debugInfo('打开领取体力和金币界面')
  let addTag = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAAAKHSURBVEiJtZY5b+MwEIU/UrRsCYkhuDcC5P//mrSuUriIEUeGdfPcIiDX8RVvsQ9goQHn4JvHocRmswn7/R6tNbfgvcday/F4pO97pJTkeY5SCiEEIYSbvkprjff+5gYAYwy73Y63tzfe39+Zz+e8vr6yXq9ZrVZ3fWXXdXcTOOeYponD4UDf9xhjGIaBuq6p6zpVH0K4utQ4jncr8N6noEIIFosFAOM40nXdXV8A+euOOxBC/N8E57jWbHVvs3MO7/1NldxTz68JvPeM45gSPYJrlKksyy6Mfd/T9z0hhKTzKOcYRCmFUooQAlLeZloBHI9HhmFIl20YBoZhQEpJlmVorWnbFmNMqtQ5xzAMfH5+XiQQQiRfZa1lu93y8fFB0zSJnliZlBLvPU3TYIxBCIEQAmMMdV1jrb2gKAbP8xxljGGz2bDb7S6aJqVMTqdJQwhYa2mahsPh8CN4pNw5h9b6e1S0bZtmzPlR48qyLB3de5+WtTb1KgY+vZxKa81isaAoipuyi4HPTxeH3im89zjn/ophmiZeXl54fn6mbduLINEpzqHIuVKKoih4enpKSgshME0TzjmklMxmM5QQgqqqKIoiqSRWHcfxNE1st1u+vr6YpgmA2WxGVVWs1+tElXMO51yiTEqJklJSliVlWV7Qkuc5QgjatmW/3yd5xmaWZclqtUoNvXYh1b1LEumw1qK1TlXCdzPjt9Y6STgi9vOhYZdlGcvlkvl8/sMeQsAYk96T03cg4qEEpzI9Rwx+a3TfHHbnQcZxTJr/FzyUIMJaS3wBo1pO6XkowbW/hKi0OD2jLcuyH3sjTac2dY27c1tsclVVdF1HCIHlcvlD2nGkRMQkfwDIO+0j2WCarAAAAABJRU5ErkJggg=='
  let screen = commonFunctions.captureScreen()
  debugInfo('准备截图查找目标：领取体力和金币按钮')
  let openBtns = images.matchTemplate(images.cvtColor(images.grayscale(screen), 'GRAY2BGRA'), images.fromBase64(addTag), {region: [0,0,config.device_width,350]})
  debugInfo(['图片查找结果：{}', JSON.stringify(openBtns)])
  openBtns = openBtns.points
  let isFinish = false
  while (!isFinish) {
    if (openBtns&&openBtns.length>0) {
      for(let i=0;i<openBtns.length;) {
        isFinish = true
        
        if (new Date().getTime() - startTimestamp > 600000) {
          debugInfo('运行时间超过10分钟，先退出完成其他任务，一分钟后继续')
          setupNextRunTime(1)
          break
        }
      
            let openBtn = openBtns[i]
        debugInfo(['点击领取体力和金币按钮: {},{}',openBtn.x,openBtn.y])
        automator.clickPointRandom(openBtn.x, openBtn.y+10)
        sleep(3000)
        screen = commonFunctions.captureScreen()
        let browseADBtns = localOcrUtil.recognizeWithBounds(screen,[0,config.device_height/4,config.device_width,config.device_height/2],'^.*浏览广告$')
        if (browseADBtns && browseADBtns.length > 0) {
          let browseADBtn = browseADBtns[browseADBtns.length-1]
          debugInfo(['OCR找到：{}', browseADBtn.label])
          WarningFloaty.addRectangle('浏览广告', boundsToRegion(browseADBtn.bounds))
          automator.clickRandom(wrapOcrPointWithBounds(browseADBtn.bounds))
          WarningFloaty.clearAll()
          if (doBrowseTask()) {
            isFinish = false
          }
        } 
        if (isFinish) {
          debugInfo('未找到浏览广告按钮或按钮不可用，跳过')
          i++
          closePopup()
        }
      };
    } else {
      debugInfo('未找到领取体力和金币按钮')
      break
    }
  }
}

function exitMengxiaoYuan () {
  automator.back()
  sleep(500)
  automator.back()
}

function exec () {
  //萌小院需时较长，设置超时时间为90分钟
  runningQueueDispatcher.renewalRunningTask(20)
  startTimestamp = new Date().getTime()
    
  //打开支付宝芭芭农场
  BBFarmRunner.openAlipayFarm()

  //进入萌小院游戏
  enterMengxiaoYuan()

  try {
    //跳过启动弹窗
    skipPopupIfNeed()

    //解锁宝箱
    unlockBox()

    //打开补充体力界面并并领取
    openGetStrengthAndCoin()

    //解锁宝箱
    unlockBox()

    //打开侧边栏
    if (!openSideBar()) {
      debugInfo('未找到侧边栏按钮，5分钟后再试')
      setupNextRunTime(1)
      return
    }
    
    //打开好友列表并领取体力
    openFriendList()
    
    //打开抽奖并免费抽奖
    openLottery()

    if (!actionBtns.backBtn) {
      debugInfo('未找到返回按钮')
      return
    }
    
    //打开商城并领取免费商品
    openShop()

    //关闭侧边栏
    automator.clickPointRandom(config.device_width/2, 200)

    //解锁宝箱
    unlockBox()
  } finally {
    //退出萌小院并关闭支付宝
    debugInfo('退出萌小院并关闭支付宝')
    exitMengxiaoYuan()
  }

}

function unlockBox() {
  const lockTag = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAjCAYAAACU9ioYAAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAAARxSURBVEiJpZbbbtNOF8V/M+ND4jQNbdVUIApCgBAXvEHfnDfgDi4QBZFGharBahMnPttjz/8in0dJ08PFt6RI9nhrZc8+rL3F58+fjVIKIQTGGKSUKKXwfZ/u/C6MMTRNQ1VVaK1p2xYhBFJKHGMMbduilMLzPJqmIcsyrq6uSNOUPM/J85y2bZFS0uv16Pf7DAYDDg4O6Pf7eJ5HXde0bYsDIKVECIHWmjRNCcOQ379/E4Yh8/mcOI7RWqOUYjgccnBwwHg85u3bt5ycnLC3t4cQAiEEjhCCfr9PHMf8+vWLv3//EoYhq9WKoiioqoqmaQBo25YkSSjLkiiKmM1mHB8fc3p6yrt37zg8PMTxPI8sy7i+vubHjx/c3NyQJAlaa54/f86LFy8AUEqhlAIgSRLm8zlRFJGmKXEcI6VEa70mnM1mTCYTJpMJTdPYWH38+JGzszMAPM/D930Arq6u+P79O9++fePfv38sFguklOsYtm3L+fk5P3/+xBiDMQYhBGdnZ7x582YnwwBHR0d8+vQJgPPzcy4uLuw3aYxhsVgQRZElk1IyHA7p9Xr3EvZ6PY6Pj3n//j2vXr1CCMFqtSKKonWWN9HVXdu2rFYrhsMhSinrvfVESl6/fs1isQBgNpsRBMEuIYDWmq9fv9Lr9ZBSWoLueRPdzTrcSwgwnU633rsGeAq7f/l/Qnz58sVMp1OWy+WjhmVZUhTFozaj0QjHdV0+fPhwrwhsoigK8jwH1gnTWu/YSCnXrVeW5ZPxEULYMiqKgrIsd2yUUjhBEKCUoixLqqp6kFBrbXu6qqp7HRBCrAkdx0EIsUOolMJxHKSU5HluJeqh27Rti6OUIggCjDHEcbxVU51UBUEAQF3XJElCGIbMZrN7SZ1OefM8t2S+7zMajdjf32dvbw/P82zz+76P67r0ej3CMCTLsm3CTtu6IEspCYKA09NTXNfdMpZSMhgMGAwGjMdjqqqiLEsbWwCZ5/nWwWg04vDw0GrfQxBCcHJywng83io5qbXeilsQBFbSH4OUkmfPnjEajbavvPlijMH3ffr9/qNkHbrrbxHWdY3WmjzPSZKEly9fPundJqqqshImhFgrdtu2ds5mWUZRFPi+/yRxZ5+mqZU3qzaO4zAYDMiyjPl8/mQrGmNYLpcsl0uaprF5cABb/VJKVqsVUkpc12V/f98Opo6kS2LTNEwmEy4vL+1M3opht05kWYYxxgrBaDTCdV27qhRFQZZlxHHMnz9/mM/nVsmNMThxHG/FyhhDWZbc3NzQNA1N03B0dITrujRNQxRFTKdTLi4urD52mwewTsrmgZQSYwxpmlpRHQ6HuK6L1prLy0u793SZ7X7GmN0R0LlfVRXz+ZwwDK2Y1nXN9fU1t7e3dtxuxs8mpZvHHYQQVrbuosv+Q63pOI5Dl5i76PSwKAqUUuR5bj3bRFcy/3PEsYvjXQPXdXEch+VyaffE7vw+KKXWM6XTuE3Cuq6p65rb21vSNKVtW8qypKuK+0iFEPwHJrSp5xBPy4kAAAAASUVORK5CYII='
  let lockBox = captureAndCheckByImg(lockTag,'箱锁标识',null,null,1)
  if (lockBox) {
    debugInfo('发现宝箱锁，尝试解锁')
    lockBox.left -= 50
    lockBox.top += 30
    lockBox.right -= 20
    lockBox.bottom += 50
    WarningFloaty.addRectangle('解锁宝箱', boundsToRegion(lockBox))
    for(let i=0;i<3;i++){
      automator.clickRandom(lockBox)
      sleep(2000)
      let unlockBtn = captureAndCheckByOcr('^解锁$','解锁按钮',[config.device_width/2, config.device_height-300,config.device_width/2,300],null,null,1)
      if (unlockBtn) {
        //获取解锁所需时间
        let unlockTime = localOcrUtil.recognizeWithBounds(commonFunctions.captureScreen(),[config.device_width/2, config.device_height-300,config.device_width/2,300],"^\\d+:\\d+$")
        if (unlockTime && unlockTime.length>0) {
          debugInfo('OCR找到了解锁时间：'+unlockTime[0].label)
          let regexResult = /(\d+):(\d+)/.exec(unlockTime[0].label)
          let min = parseInt(regexResult[1])
          let sec =parseInt(regexResult[2])
          min += sec>0?2:1
          setupNextRunTime(min)
        }
        debugInfo('点击解锁按钮')
        automator.clickRandom(unlockBtn)
        sleep(3000)
        break
      } else {
        debugInfo('未找到解锁按钮')
        // setupNextRunTime(0)
      }
    }
    WarningFloaty.clearAll()
  }
}

  /**
   * 通过图片base64查找目标 并展示位置 默认为灰度找图 速度快一些
   * 
   * @param {string} base64 灰度目标图片base64
   * @param {string} content 
   * @param {number} delay 展示时间
   * @param {boolean} clickIt 找到后点击目标
   * @param {number} loop 循环查找次数 默认查找三次 间隔500ms
   * @returns 
   */
  function captureAndCheckByImg(base64, content, delay, clickIt, loop) {
    delay = delay || 800
    if (typeof loop === 'undefined') {
      loop = 3
    }
    let screen = commonFunctions.captureScreen()
    debugInfo('准备截图查找目标：' + content)
    if (screen) {
      let collect = OpenCvUtil.findByImageSimple(images.cvtColor(images.grayscale(screen), 'GRAY2BGRA'), images.fromBase64(base64))
      if (collect) {
        debugInfo('截图找到了目标：' + content)
        FloatyInstance.setFloatyInfo({
          x: collect.centerX(),
          y: collect.centerY()
        }, '找到了 ' + content)
        sleep(delay)
        if (clickIt) {
          automator.clickPointRandom(collect.centerX(), collect.centerY())
          sleep(delay)
        }
        return wrapImgPointWithBounds(collect)
      } else if (loop-- > 1) {
        sleep(500)
        debugInfo(['未找到目标「{}」进行下一次查找，剩余尝试次数：{}', content, loop])
        return captureAndCheckByImg(base64, content, delay, clickIt, loop)
      }
    }
    FloatyInstance.setFloatyInfo({ x: config.device_width / 2.7, y: config.device_height / 2 }, '未找到 ' + content)
    sleep(delay)
    return null
  }

  function captureAndCheckByOcr(regex, content, region, delay, clickIt, loop) {
    if (!localOcrUtil.enabled) {
      warnInfo('当前AutoJS不支持OCR')
      return null
    }
    delay = delay || 800
    if (typeof loop === 'undefined') {
      loop = 3
    }
    FloatyInstance.hide()
    sleep(40)
    let screen = commonFunctions.captureScreen()
    FloatyInstance.restore()
    debugInfo('准备OCR查找目标：' + content)
    if (screen) {
      let findText = localOcrUtil.recognizeWithBounds(screen, region, regex)
      if (findText && findText.length > 0) {
        let collect = findText[0].bounds
        debugInfo(['OCR找到了目标 [{}]: {}', content, findText[0].label])
        FloatyInstance.setFloatyInfo({
           x: collect.centerX(),
           y: collect.centerY()
         }, '找到了 ' + content)
        sleep(delay)
        if (clickIt) {
          automator.clickPointRandom(collect.centerX(), collect.centerY())
          sleep(delay)
        }
        return wrapOcrPointWithBounds(collect)
      } else if (loop-- > 1) {
        sleep(delay)
        debugInfo(['未找到目标「{}」进行下一次查找，剩余尝试次数：{}', content, loop])
        debugForDev(['图片数据：[data:image/png;base64,{}]', images.toBase64(images.clip(screen, config.device_width / 2, config.device_height * 0.7, config.device_width - config.device_width / 2, config.device_height - config.device_height * 0.7))])
        return captureAndCheckByOcr(regex, content, region, delay, clickIt, loop)
      }
    } else {
      errorInfo('截图失败')
    }
    FloatyInstance.setFloatyInfo({ x: config.device_width / 2.7, y: config.device_height / 2 }, '未找到 ' + content)
    sleep(delay)
    return null
  }

  /**
   * 给图片识别点增加bounds方法 主要用于获取centerX 和 centerY
   * @param {object} imagePoint 
   */
  function wrapImgPointWithBounds(imagePoint) {
    if (imagePoint && !imagePoint.bounds) {
      imagePoint.bounds = () => {
        return imagePoint
      }
    }
    return imagePoint
  }

  /**
   * 给OCR识别点增加bounds方法 主要用于获取centerX 和 centerY
   * @param {Rect} ocrPoint 
   */
  function wrapOcrPointWithBounds(ocrPoint) {
    if (!ocrPoint) {
      return null
    }
    if (!ocrPoint.bounds) {
      let newPoint = Object.create(ocrPoint)
      newPoint.bounds = () => ocrPoint
      return newPoint
    }
    return ocrPoint
  }

  function boundsToPosition(bounds) {
    return { x: bounds.centerX(), y: bounds.centerY() }
  }

  function boundsToRegion(bounds) {
    return [bounds.left, bounds.top, bounds.width(), bounds.height()]
  }

