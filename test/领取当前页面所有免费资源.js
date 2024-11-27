let { config } = require('../config.js')(runtime, global)
let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, global)
let runningQueueDispatcher = singletonRequire('RunningQueueDispatcher')
let commonFunctions = singletonRequire('CommonFunction')
let resourceMonitor = require('../lib/ResourceMonitor.js')(runtime, global)
let widgetUtils = singletonRequire('WidgetUtils')
let automator = singletonRequire('Automator')
let alipayUnlocker = singletonRequire('AlipayUnlocker')
let FileUtils = singletonRequire('FileUtils')
let openCvUtil = require('../lib/OpenCvUtil.js')
let { logInfo, errorInfo, warnInfo, debugInfo, infoLog } = singletonRequire('LogUtils')
let FloatyInstance = singletonRequire('FloatyUtil')
let localOcrUtil = require('../lib/LocalOcrUtil.js')
let WarningFloaty = singletonRequire('WarningFloaty')
let LogFloaty = singletonRequire('LogFloaty')
let yoloTrainHelper = singletonRequire('YoloTrainHelper')
let YoloDetection = singletonRequire('YoloDetectionUtil')
FloatyInstance.init()
FloatyInstance.enableLog()

logInfo('======加入任务队列，并关闭重复运行的脚本=======')
runningQueueDispatcher.addRunningTask()
let callStateListener = !config.is_pro && config.enable_call_state_control ? singletonRequire('CallStateListener') : { exitIfNotIdle: () => { } }

function boundsToRegion(bounds) {
  return [bounds.left, bounds.top, bounds.width(), bounds.height()]
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
      return captureAndCheckByOcr(regex, content, region, delay, clickIt, loop)
    }
  } else {
    errorInfo('截图失败')
  }
  FloatyInstance.setFloatyInfo({ x: config.device_width / 2.7, y: config.device_height / 2 }, '未找到 ' + content)
  sleep(delay)
  return null
}

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
  let noBrowseCount = 0

  // while (repeat<5) {
    //OCR识别所有“免费”文字并点击
    let freeTexts = null
    // 领取当前所有免费商品
    do {
      freeTexts = localOcrUtil.recognizeWithBounds(commonFunctions.captureScreen(), region, '^.*(免费|开启).*$')
      if (freeTexts && freeTexts.length > 0) {
        taskFinished = false
        WarningFloaty.clearAll()
        let freeText = freeTexts[0]
        debugInfo(['OCR找到了免费文字：{}', freeText.label])
        let collect = freeText.bounds
        WarningFloaty.addRectangle(freeText.label, boundsToRegion(collect))
  
        automator.clickPointRandom(collect.centerX(), collect.centerY())
        sleep(1000)
        
        let getBtn = captureAndCheckByOcr('确定','领取按钮',null,null,null,1)
        if (getBtn) {
          automator.clickRandom(getBtn)
          sleep(5000)
        }
  
        if (doBrowseTask()) {
          noBrowseCount = 0
        } else {
          noBrowseCount++
        }

        getBtn = captureAndCheckByOcr('领取','领取按钮',null,null,null,1)
        if (getBtn) {
          automator.clickRandom(getBtn)
          sleep(5000)
        }
      } else {
        debugInfo('未找到收集按钮')
      }
      WarningFloaty.clearAll()
    } while (freeTexts && freeTexts.length > 0 && noBrowseCount < 5)
      
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

    }
    WarningFloaty.clearAll()
  // }
}

function exec() {
  getFreeResource()
}

// 注册自动移除运行中任务
commonFunctions.registerOnEngineRemoved(function () {
    debugInfo('校验并移除已加载的dex')
    // 移除运行中任务
    runningQueueDispatcher.removeRunningTask(true, false, () => {
      // 保存是否需要重新锁屏
      config.isRunning = false
    })
  }, 'mengxiaoyuan')
  
  callStateListener.exitIfNotIdle()
  if (!commonFunctions.ensureAccessibilityEnabled()) {
    errorInfo('获取无障碍权限失败')
    exit()
  }
  
  exec()

  runningQueueDispatcher.removeRunningTask(true)
  exit()
  