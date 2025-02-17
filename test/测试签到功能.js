let { config } = require('../config.js')(runtime, this)
let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, this)
let WidgetUtils = singletonRequire('WidgetUtils')
let commonFunctions = singletonRequire('CommonFunction')
let FloatyInstance = singletonRequire('FloatyUtil')
let runningQueueDispatcher = singletonRequire('RunningQueueDispatcher')
let { logInfo, errorInfo, warnInfo, debugInfo, infoLog, debugForDev, flushAllLogs } = singletonRequire('LogUtils')

runningQueueDispatcher.addRunningTask()
FloatyInstance.setFloatyInfo({ x: config.device_width * 0.4, y: config.device_height / 2 }, '准备执行 签到功能测试' )
config._debugging = true

let callStateListener = !config.is_pro && config.enable_call_state_control ? singletonRequire('CallStateListener') : { exitIfNotIdle: () => { } }

// 注册自动移除运行中任务
commonFunctions.registerOnEngineRemoved(function () {
    config.resetBrightness && config.resetBrightness()
    debugInfo('校验并移除已加载的dex')
    // 移除运行中任务
    runningQueueDispatcher.removeRunningTask(true, false, () => {
      config.isRunning = false
    })
  }, 'main')
  
callStateListener.exitIfNotIdle()
if (!commonFunctions.ensureAccessibilityEnabled()) {
  errorInfo('获取无障碍权限失败')
  exit()
}
  
logInfo('======初始化SQLite=======')
let signTaskService = singletonRequire('SignTaskService')
// 初始化数据库连接
signTaskService.init()

commonFunctions.showCommonDialogAndWait('签到测试')
// 请求截图权限
commonFunctions.requestScreenCaptureOrRestart(true)
config.is_test = true
// let signRunner = require('../core/Weibo.js')
// let signRunner = require('../core/DingDong.js')
// let signRunner = require('../core/AlipayMerchantCredits.js')
// let signRunner = require('../core/AntCredits.js')
// let signRunner = require('../core/JingDongBeans.js')
let signRunner = require('../core/BBFarm.js')
// let signRunner = require('../core/XiaomiShop.js')
signRunner.setName('签到测试').exec()
runningQueueDispatcher.removeRunningTask()
exit()
