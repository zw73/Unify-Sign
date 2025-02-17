/**
 * 每个项目里面新增或者修改的方法集合
 */
let { config } = require('../config.js')(runtime, this)
let singletonRequire = require('./SingletonRequirer.js')(runtime, this)
let storageFactory = singletonRequire('StorageFactory')
let _logUtils = singletonRequire('LogUtils')
let formatDate = require('./DateUtil.js')
let SIGN_IN_SUCCEED = "signInSucceed"
let RANDOM_START = "randomStart"
let TB_FAILED_COUNT = "TB_FAILED_COUNT"
let TB_SIGNED = "TB_SIGNED"
let ALI_CREDITS_SIGNED = "ALI_CREDITS_SIGNED"
let FREERESOURCE_COLLECTED = "FREERESOURCE_COLLECTED"
let BaseCommonFunction = require('./BaseCommonFunctions.js')

const ProjectCommonFunction = function () {
  BaseCommonFunction.call(this)

  this.keyList = [SIGN_IN_SUCCEED]

  function warnDeprecated() {
    _logUtils.errorInfo(['此方法已经标记为过时，后续会进行删除，请勿继续使用'], true)
  }
  /**
   * @deprecated
   * @param {*} name 
   * @returns 
   */
  this.checkIsSignExecutedToday = function (name) {
    warnDeprecated()
    if (config.develop_mode) {
      // 开发模式直接返回false
      return false
    }
    let signInSucceed = storageFactory.getValueByKey(SIGN_IN_SUCCEED)
    let success = signInSucceed.succeed[name]
    if (success) {
      if (isNaN(parseInt(success))) {
        // 非数字直接返回true 执行过
        return true
      } else {
        return new Date().getTime() < success
      }
    }
    return false
  }

  /**
   * 获取执行时间
   * @param {*} name 
   * @returns 
   * @deprecated
   */
  this.getExecutedInfo = function (name) {
    warnDeprecated()
    let signInSucceed = storageFactory.getValueByKey(SIGN_IN_SUCCEED)
    let success = this.checkIsSignExecutedToday(name)
    let executedTime = ''
    if (success && signInSucceed.succeed_time) {
      executedTime = signInSucceed.succeed_time[name] || ''
    }
    return {
      success: success,
      executedTime: executedTime
    }
  }

  /**
   * 
   * @param {*} name 
   * @param {*} timeout 
   * @deprecated
   */
  this.setExecutedToday = function (name, timeout) {
    warnDeprecated()
    let signInSucceed = storageFactory.getValueByKey(SIGN_IN_SUCCEED)
    if (typeof timeout !== 'undefined' && timeout > 0) {
      signInSucceed.succeed[name] = new Date().getTime() + timeout
    } else {
      signInSucceed.succeed[name] = true
    }
    if (Object.prototype.toString.call(signInSucceed.succeed_time) !== '[object Object]') {
      // 兼容老数据
      signInSucceed.succeed_time = {}
    }
    signInSucceed.succeed_time[name] = formatDate(new Date())
    storageFactory.updateValueByKey(SIGN_IN_SUCCEED, signInSucceed)
  }

  /**
   * @deprecated
   * @param {*} name 
   */
  this.markNotExecuted = function (name) {
    warnDeprecated()
    let signInSucceed = storageFactory.getValueByKey(SIGN_IN_SUCCEED)
    signInSucceed.succeed[name] = false
    storageFactory.updateValueByKey(SIGN_IN_SUCCEED, signInSucceed)
  }

  /**
   * @deprecated
   * @returns 
   */
  this.setRandomStartedIfNeeded = function () {
    warnDeprecated()
    let executedInfo = storageFactory.getValueByKey(RANDOM_START)
    if (executedInfo.executed) {
      return true
    } else {
      let randomMinutes = parseInt(480 + (Math.random() * 1000 % 720))
      executedInfo.executed = true
      executedInfo.randomMinutes = randomMinutes
      storageFactory.updateValueByKey(RANDOM_START, executedInfo)
      _logUtils.debugInfo(['随机延迟{}分钟后启动', randomMinutes])
      this.setUpAutoStart(randomMinutes)
      exit()
    }
  }

  this.checkIsTaobaoSigned = function () {
    return !!this.getTodaysRuntimeStorage(TB_SIGNED).executed 
  }

  this.setTaobaoSigned = function () {
    return this.updateRuntimeStorage(TB_SIGNED, { executed: true })
  }

  this.checkTaobaoFailedCount = function () {
    return this.getTodaysRuntimeStorage(TB_FAILED_COUNT).count || 0
  }

  this.increaseTbFailedCount = function () {
    let currentCount = this.checkTaobaoFailedCount()
    this.updateRuntimeStorage(TB_FAILED_COUNT, { count: currentCount + 1 })
  }

  this.checkIsAliCreditsSigned = function () {
    return !!this.getTodaysRuntimeStorage(ALI_CREDITS_SIGNED).executed 
  }

  this.setAliCreditsSigned = function () {
    return this.updateRuntimeStorage(ALI_CREDITS_SIGNED, { executed: true })
  }
  
  /**
   * 校验今日是否已经领取所有免费商品
   * @returns 
   */
  this.checkFreeResourceCollected = function () {
    let collectInfo = this.getFullTimeRuntimeStorage(FREERESOURCE_COLLECTED)
    if (collectInfo.collected) {
      return collectInfo.timeout > new Date().getTime()
    }
    return false
  }

  /**
   * 设置今日已经领取所有免费商品
   */
  this.setFreeResourceCollected = function () {
    //计算得到当前时间之后下一个19:00的毫秒数
    function getNext1900Millis() {
      const now = new Date();
      const next1900 = new Date();
      
      next1900.setHours(19);
      next1900.setMinutes(0);
      next1900.setSeconds(0);
      next1900.setMilliseconds(0);
      
      // 如果当前时间已经过了19:00，则设置为第二天的19:00
      if (now.getTime() > next1900.getTime()) {
        next1900.setDate(next1900.getDate() + 1);
      }
      
      return next1900.getTime();
    }
     
    this.updateRuntimeStorage(FREERESOURCE_COLLECTED, { collected: true, timeout: getNext1900Millis() })
  }    

  /**
   * 0:0 -> 5:30 这个时间段内禁止运行
   */
  this.inLimitTimeRange = function () {
    let date = new Date()
    let hours = date.getHours()
    let minutes = date.getMinutes()
    _logUtils.debugInfo(['current time [{}:{}]', hours, minutes])
    let checkValue = hours * 100 + minutes
    return !config.develop_mode && 0 <= checkValue && 530 >= checkValue
  }
}

ProjectCommonFunction.prototype = Object.create(BaseCommonFunction.prototype)
ProjectCommonFunction.prototype.constructor = ProjectCommonFunction

ProjectCommonFunction.prototype.initStorageFactory = function () {
  storageFactory.initFactoryByKey(SIGN_IN_SUCCEED, { succeed: {}, succeed_time: {} })
  storageFactory.initFactoryByKey(RANDOM_START, { executed: false })
  storageFactory.initFactoryByKey(TB_FAILED_COUNT, { count: 0 })
  storageFactory.initFactoryByKey(TB_SIGNED, { executed: false })
  storageFactory.initFactoryByKey(ALI_CREDITS_SIGNED, { executed: false })
}


module.exports = ProjectCommonFunction