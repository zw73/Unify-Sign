/*
 * @Author: TonyJiangWJ
 * @Date: 2020-04-25 16:46:06
 * @Last Modified by: TonyJiangWJ
 * @Last Modified time: 2023-07-19 23:38:40
 * @Description: 
 */

let { config } = require('../config.js')(runtime, this)
let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, this)
let commonFunctions = singletonRequire('CommonFunction')
let alipayUnlocker = singletonRequire('AlipayUnlocker')
let widgetUtils = singletonRequire('WidgetUtils')
let logUtils = singletonRequire('LogUtils')
let automator = singletonRequire('Automator')
let FloatyInstance = singletonRequire('FloatyUtil')
let warningFloaty = singletonRequire('WarningFloaty')
let AiUtil = require('../lib/AIRequestUtil.js')
let BaseSignRunner = require('./BaseSignRunner.js')

function SignRunner () {
  BaseSignRunner.call(this)

  const TASK_UI_TestString = '肥料明细|做任务集肥料'

  let bb_farm_config = config.bb_farm_config
  this.execFailed = false

  this.exec = function () {
    //芭芭农场需时较长，设置超时时间为40分钟
    runningQueueDispatcher.renewalRunningTask(40)
    
    debugInfo(['开始执行芭芭农场脚本, execFailed: {}', this.execFailed])
    // 打开支付宝芭芭农场
    this.executeAlipayFarm()
    sleep(3000)
    
    // 打开淘宝芭芭农场
    this.executeTaobaoFarm()
    sleep(3000)

    commonFunctions.minimize()
    debugInfo(['结束执行芭芭农场脚本, execFailed: {}', this.execFailed])
    if (!this.execFailed) {
      debugInfo('芭芭农场执行完毕')
      this.setExecuted()
    } else {
      debugInfo('芭芭农场执行失败')
    }

    // let date = new Date()
    // let hours = date.getHours()
    // let minutes = date.getMinutes()
    // let checkValue = hours * 100 + minutes
    // if (530 <= checkValue && 2300 >= checkValue) {
    //   debugInfo('设定一个小时后运行下一次任务')
    //   this.createNextSchedule(this.taskCode, date.getTime() + 60*60*1000)
    // }
  }

  this.executeAlipayFarm = function () {
    FloatyInstance.setFloatyPosition(400, 400)
    FloatyInstance.setFloatyText('准备打开支付宝芭芭农场页面')
    this.execFailed = this.execFailed || !this.openAlipayFarm()

    if (!this.captureAndCheckByImg(bb_farm_config.collect_btn_alipay, '每日签到', null, true, 1)) {
      this.captureAndCheckByOcr('点击领取', '每日签到', [config.device_width/2,config.device_height/2,config.device_width/2,config.device_height/2], null, true, 1)
    }
    sleep(1000)
    
    // 签到任务
    this.collectAlipayTask()
    sleep(3000)

    // 限时任务和施肥
    this.execFailed = this.execFailed || !this.doFertilizeTask()

  }

  /**
   * 检查是否已进入支付宝芭芭农场
   * @returns boolean
   * */
  this.checkIsInAlipayFarm = function (timeout) {
    timeout = timeout || 2000
    let checkResult = widgetUtils.widgetCheck('芭芭农场,种果树得水果，助农增收',timeout)
    if (!checkResult) {
      checkResult = this.checkForTargetImg(bb_farm_config.entry_check_alipay, '农场加载校验')
    }
    return checkResult
  }

  function openAlipayMultiLogin (reopen) {
    if (config.multi_device_login && !reopen) {
      debugInfo(['已开启多设备自动登录检测，检查是否有 进入支付宝 按钮'])
      let entryBtn = widgetUtils.widgetGetOne(/^进入支付宝$/, 1000)
      if (entryBtn) {
        FloatyInstance.setFloatyText('其他设备正在登录，等待5分钟后进入')
        commonFunctions.waitForAction(300, '等待进入支付宝')
        unlocker && unlocker.exec()
        automator.clickRandom(entryBtn)
        sleep(1000)
        return true
      } else {
        debugInfo(['未找到 进入支付宝 按钮'])
      }
    }
  }

  this.openAlipayFarm = function (reopen) {
    let _package_name = 'com.eg.android.AlipayGphone'
    app.startActivity({
      action: 'VIEW',
      data: 'alipays://platformapi/startapp?appId=68687599&source=normalshare&chInfo=ch_share__chsub_CopyLink&fxzjshareChinfo=ch_share__chsub_CopyLink&apshareid=82a6fd96-1f82-4975-bb8c-ac87e8aedfba&shareBizType=BABAFarm',
      // data: 'https://render.alipay.com/p/s/i/?scheme=alipays%3A%2F%2Fplatformapi%2Fstartapp%3FappId%3D68687599%26source%3Dnormalshare%26chInfo%3Dch_share__chsub_CopyLink%26fxzjshareChinfo%3Dch_share__chsub_CopyLink%26apshareid%3D82a6fd96-1f82-4975-bb8c-ac87e8aedfba%26shareBizType%3DBABAFarm',
      packageName: _package_name
    })
    sleep(500)
    FloatyInstance.setFloatyText('校验是否有打开确认弹框')
    let startTime = new Date().getTime()
    while (new Date().getTime() - startTime < 30000) {
      let confirm = widgetUtils.widgetGetOne(/^打开$/, 1000)
      if (confirm) {
        this.displayButtonAndClick(confirm, '找到了打开按钮')
      } else {
        FloatyInstance.setFloatyText('没有打开确认弹框')
      }

      if (openAlipayMultiLogin(reopen)) {
        return this.openAlipayFarm(true)
      }
    
      if (config.is_alipay_locked) {
        alipayUnlocker.unlockAlipay()
        sleep(1000)
      }
  
      if (this.checkIsInAlipayFarm()) {
        FloatyInstance.setFloatyText('已进入支付宝农场')
        return true
      }
      
      sleep(1000)
    }
    return false
  }

  /**
   * 获取当前界面是否在项目界面
   */
  this.isInProjectUI = function (projectCode, timeout) {
    timeout = timeout || 2000
    switch (projectCode) {
      case 'BBFarm.alipay':
        return this.checkIsInAlipayFarm(timeout)
      case 'BBFarm.taobao':
        return this.checkIsInTaobaoFarm(timeout)
      default:
        return false
    }
  }

  /**
   * 获取当前界面是否在任务界面
   */
  this.isInTaskUI = function (projectCode, timeout) {
    timeout = timeout || 2000
    switch (projectCode) {
      case 'BBFarm.alipay':
        return widgetUtils.widgetWaiting('做任务集肥料', '任务列表', timeout)
      case 'BBFarm.taobao':
        return widgetUtils.widgetWaiting('肥料明细', '任务列表', timeout)
      default:
        return false
    }
  }

  this.startApp = function (projectCode) {
    switch (projectCode) {
      case 'BBFarm.alipay':
        return this.openAlipayFarm()
      case 'BBFarm.taobao':
        return this.openTaobaoFarm()
      default:
        return false
    }
  }

  this.openTaskWindow = function (projectCode) {
    switch (projectCode) {
      case 'BBFarm.alipay':
        return this.openAlipayFarmTaskWindow()
      case 'BBFarm.taobao':
        return this.openTaobaoFarmTaskWindow()
      default:
        return false
    }
  }

  this.backToTaskUI = function (projectCode) {
    warnInfo('检查是否在任务界面，不在的话返回，尝试两次')
    let backResult = false
    let waitCount = 2
    while (!(backResult=this.isInTaskUI(projectCode,5000)) && waitCount-->0) {
      automator.back()
      sleep(1000)
    }
  
    if (backResult) {
      sleep(2000)
      return true
    }
    
    warnInfo(['返回失败，重新尝试打开任务界面'])
    if (!this.isInProjectUI(projectCode)) {
      warnInfo(['不在项目界面，重新尝试打开项目'])
      this.startApp(projectCode)
    }
  
    if (!this.isInProjectUI(projectCode)) {
      warnInfo(['打开项目失败，5分钟后重新尝试'])
      commonFunctions.setUpAutoStart(5)
      return false
    }
  
    if(!this.isInTaskUI(projectCode)) {
      if (!this.openTaskWindow(projectCode)) {
        warnInfo(['打开任务界面失败，5分钟后重新尝试'])
        commonFunctions.setUpAutoStart(5)
        return false
      }
    }
    return true
  }

  this.doCommonTask = function (projectCode, titleText, entryBtn, timeout, needScroll) {
    if (!commonFunctions.checkAppInstalledByName(titleText)) {
      LogFloaty.pushLog('未安装应用，跳过执行：'+titleText)
      return false
    }
    
    if (!entryBtn) {
      LogFloaty.pushLog('无入口按钮，跳过执行：'+titleText)
      return false
    }
    titleText = titleText || entryBtn.text()
    timeout = timeout || 15
    let taskType = 'browse'
  
    currentRunning = commonFunctions.myCurrentPackage()
    debugInfo('当前包名：'+currentRunning)
    
    entryBtn.click()
    LogFloaty.pushLog('等待进入 '+titleText+', 计时：'+timeout+', 滑动：'+needScroll)
    commonFunctions.waitForAction(10, titleText, function () {
      let popupConfirmBtn = widgetUtils.widgetGetOne("^允许$", 1000, false, false, (m) =>
        m.boundsInside(0, config.device_height * 0.2, config.device_width, config.device_height)
      );
      if (popupConfirmBtn) {
        debugInfo("找到了弹窗确认按钮");
        automator.clickRandom(popupConfirmBtn);
        sleep(5000)
        return true
      }
      return false
    });
  
    if (currentRunning != commonFunctions.myCurrentPackage()) {
      taskType = 'visitapp'
      //已进入目标应用，等待加载完成
      sleep(5000)
    } else if (this.isInTaskUI(projectCode)) {
      LogFloaty.pushLog('进入任务失败：'+titleText)
      return false
    }
  
    //检查是否有验证窗口，有则等待直到消失
    commonFunctions.waitForTBVerify()
  
    //根据需要等待一段时间进行浏览
    if (timeout) {
      LogFloaty.pushLog(titleText+' 等待倒计时结束')
      let limit = timeout
      while (limit-- > 0) {
        //检查是否有弹窗
        let popupCancelBtn = widgetUtils.widgetGetOne("^取消|忽略|关闭|拒绝$", 1000, false, false, m => m.boundsInside(0,  config.device_height * 0.2, config.device_width, config.device_height))
        if (popupCancelBtn) {
          debugInfo('找到了弹窗取消按钮')
          automator.clickRandom(popupCancelBtn)
        }
  
        LogFloaty.replaceLastLog(titleText+' 等待倒计时结束 剩余：' + limit + 's')
        if (limit % 2 == 0 && needScroll) {
          automator.scrollUpAndDown()
          sleep(100)
        } else {
          sleep(1000)
        }
      }
    } else {
      sleep(3000)
      LogFloaty.pushLog('啥也不用干 直接返回')
    }
    if (taskType == 'visitapp') {
      commonFunctions.minimize()
      sleep(1000)
      if (currentRunning != commonFunctions.myCurrentPackage()) {
        LogFloaty.pushLog('未返回原应用，直接打开 '+ currentRunning)
        app.launch(currentRunning);
        sleep(3000)
      }
    }
  
    automator.back()
    sleep(1000)
    return true
  }
  
  this.doSpecialTask = function (action,titleObj,entryBtn) {
    if (titleObj && entryBtn && this[action]) {
      return this[action](titleObj,entryBtn)
    } else {
      return false
    }
  }
  
  this.doCatchChicks = function (titleObj,entryBtn) {
    let result = false
    if (entryBtn) {
      LogFloaty.pushLog('等待进入 '+titleObj.text())
      entryBtn.click()
      sleep(2000);

      let confirmBtn = widgetUtils.widgetGetOne('立即捉鸡.*', 3000)
      if (confirmBtn) {
        LogFloaty.pushLog('完成捉鸡')
        automator.clickRandom(confirmBtn)
        sleep(2000)
        result = true
      } else {
        debugInfo('未找到捉鸡按钮')
      }
    }
    return result
  }

  this.doBrowseAndCollect = function (titleObj,entryBtn) {
    let result = false
    
    if (entryBtn) {
      let titleText = titleObj? titleObj.text() : entryBtn.text()
      LogFloaty.pushLog('等待进入 '+titleText)
      entryBtn.click()
      sleep(2000);

      LogFloaty.pushLog(titleText+' 等待倒计时结束和肥料袋收集完成')
      let limit = 15
      let collectDone = false
      while ((limit-- > 0) || (!collectDone && limit > -15)) {
        let btns = widgetUtils.widgetGetAll('立即领',1000)
        if (btns && btns.length > 0) {
          for (let i = 0; i < btns.length; i++) {
            let btn = btns[i]
            if (commonFunctions.isObjectInScreen(btn)) {
              //automator.clickRandom(btn)
              btn.click ()
              sleep(1000)
              if (widgetUtils.widgetWaiting('已集齐肥料袋',null,1000)) {
                collectDone = true
              }
            }
          }
        }
        automator.randomScrollDown()
        sleep(1000)
        LogFloaty.replaceLastLog(titleText+' 等待倒计时结束 剩余：' + limit + 's')
      }
      automator.back()
      sleep(1000)
      result = true
    }
    return result
  }
  
  //施肥并完成限时任务
  this.doFertilizeTask = function () {
    LogFloaty.pushLog('查找 施肥 按钮')
    let fertilizeBtn = null
    let taskBtn = widgetUtils.widgetGetOne('^任务列表$', 3000)
    if (taskBtn) {
      fertilizeBtn = {x:config.device_width/2, y:taskBtn.bounds().centerY()}
    } else {
      taskBtn = this.captureAndCheckByOcr('^施肥$', '施肥按钮')
      if (!taskBtn) {
        LogFloaty.pushWarningLog('未找到施肥按钮')
        return false
      }
      fertilizeBtn = {x:taskBtn.bounds().centerX(),y:taskBtn.bounds().centerY()}
    }
    debugInfo('找到施肥按钮：'+fertilizeBtn.x+','+fertilizeBtn.y)
    
    //施肥一次并领取施肥奖励
    let doFertilizeOnce = function () {
      //点击施肥按钮
      automator.clickPointRandom(fertilizeBtn.x,fertilizeBtn.y)
      sleep(2000)
      
      //检查是否有果树升级对话框
      let upgradeDialog = widgetUtils.widgetGetOne('^果树升级啦$', 2000)
      if (upgradeDialog) {
        //点击确认按钮
        let confirmBtn = widgetUtils.widgetGetOne('^好的$',1000)
        if (confirmBtn) {
          automator.clickRandom(confirmBtn)
          sleep(2000)
        }
      }

      //检查是否有立即领奖按钮，有则点击领奖，并完成后续任务
      let getPrizeBtn = widgetUtils.widgetGetOne('^立即领奖$',2000)
      if (getPrizeBtn) {
        automator.clickRandom(getPrizeBtn.parent().parent())
        sleep(3000)
        let confirmBtn = widgetUtils.widgetGetOne('^立即领取$',2000)
        if (confirmBtn) {
          automator.clickRandom(confirmBtn)
          sleep(2000)
        }
        let nextBtn = widgetUtils.widgetGetOne('^.*逛一逛再(得|赚).*$',3000)
        if (nextBtn) {
          automator.clickRandom(nextBtn)
          sleep(2000)
          
          let limit = 15
          while (limit-- > 0) {
            sleep(1000)
            LogFloaty.replaceLastLog(nextBtn.text()+' 等待倒计时结束 剩余：' + limit + 's')
            if (limit % 2 == 0) {
              automator.randomScrollDown()
            }
          }
          automator.back()
          sleep(2000)
        }
      }
    }

    let challengeDone = false
    let challengeBtn = this.captureAndCheckByOcr('^限时挑战.*$', '挑战按钮')
    if (!challengeBtn) {
      LogFloaty.pushWarningLog('未找到限时挑战按钮')
      challengeDone = true
    }
    while (challengeBtn) {
      if (!this.checkIsInAlipayFarm()) {
        LogFloaty.pushWarningLog('不在农场主界面，，重新启动')
        return false
      } else if (!widgetUtils.widgetCheck('^挑战\\d$', 2000)) {
        LogFloaty.pushLog('有限时挑战按钮，点击检查是否有挑战任务并完成')
        automator.clickRandom(challengeBtn)
        sleep(2000)
      }

      //查找领奖按钮并点击
      let doneCount = 0
      let challengeTitles = widgetUtils.widgetGetAll('^挑战\\d$',2000)
      if (challengeTitles && challengeTitles.length > 0) {
        challengeTitles.forEach(title => {
          debugInfo('挑战阶段：'+title.text())
          let parentView = title.parent()
          if (parentView&&parentView.childCount()>3){
            let prizeBtn = parentView.child(3)
            if (prizeBtn&&prizeBtn.childCount()>0) {
              debugInfo('挑战状态：'+prizeBtn.child(0).text())
              if (prizeBtn.child(0).text().indexOf('已完成')>=0) {
                debugInfo('挑战任务已完成：'+title.text())
                doneCount++
              }
            } else {
              debugInfo('挑战状态：'+prizeBtn.text())
            }

            let btnBounds = prizeBtn.bounds()
            let btnRegion = [btnBounds.left,btnBounds.top,btnBounds.width(),btnBounds.height()]
            if (this.captureAndCheckByOcr('^领取$', '领取按钮', btnRegion, false, false, 1)) {
              automator.clickRandom(prizeBtn)
              sleep(2000)
              let confirmTitle = widgetUtils.widgetGetOne('^恭喜获得.*肥$',2000)
              if (confirmTitle) {
                let confirmBtn = confirmTitle.parent().parent().child(1)
                if (confirmBtn) {
                  automator.clickRandom(confirmBtn)
                  sleep(2000)
                }
              }
            }
          }
        })
      }

      //查找挑战任务按钮并点击
      let actionBtns = widgetUtils.widgetGetAll('^按钮$',2000)
      if (actionBtns && actionBtns.length > 0) {
        let i = 0
        for (i = 0; i < actionBtns.length; i++) {
          let btn = actionBtns[i]
          let parentView = btn.parent().parent()
          let action = parentView.child(1).child(0).text()
          let doneTime = parentView.child(1).child(3).text()
          let needTime = parentView.child(1).child(5).text()
          debugInfo('挑战任务：'+action+' 已完成：'+doneTime+'/'+needTime)
          
          if (doneTime!=needTime) {
            if (action.indexOf('快手')>=0) {
              let currentRunning = commonFunctions.myCurrentPackage()
              automator.clickRandom(btn)
              sleep(1000)
              LogFloaty.pushLog('等待进入 '+action)
              let waitCount = 50
              while (currentRunning == commonFunctions.myCurrentPackage() && waitCount-- > 0) {
                sleep(100)
              }
              if (currentRunning != commonFunctions.myCurrentPackage()) {
                LogFloaty.pushLog(action+' 等待倒计时结束')
                let limit = timeout
                while (limit-- > 0) {
                  sleep(1000)
                  LogFloaty.replaceLastLog(action+' 等待倒计时结束 剩余：' + limit + 's')
                  if (limit % 2 == 0) {
                    automator.randomScrollDown()
                  }
                }
  
                commonFunctions.minimize()
                sleep(1000)
                if (currentRunning != commonFunctions.myCurrentPackage()) {
                  app.launch(currentRunning);
                  sleep(3000)
                }
              } else {
                LogFloaty.pushLog('进入失败，返回')
              }
              automator.back()
              sleep(1000)
            } else if (action.indexOf('施肥')>=0) {
              automator.clickRandom(btn)
              sleep(1000)
              doFertilizeOnce()              
            } else if (action.indexOf('逛好物')>=0) {
              automator.clickRandom(btn)
              sleep(1000)
              let limit = 15
              while (limit-- > 0) {
                sleep(1000)
                LogFloaty.replaceLastLog(action+' 等待倒计时结束 剩余：' + limit + 's')
                if (limit % 2 == 0) {
                  automator.randomScrollDown()
                }
              }
              automator.back()
              sleep(2000) 
            } else if (action.indexOf('首页')>=0) {
              automator.clickRandom(btn)
              sleep(3000)
              let farmBtn = widgetUtils.widgetGetOne('^芭芭农场$', 2000, null, null, m=>m.className("android.widget.TextView"))
              if (farmBtn) {
                automator.clickRandom(farmBtn)
                sleep(2000)
              }
            } else if (action.indexOf('游戏')>=0) {
              continue
            }
            break
          }
        }
        //检查已完成挑战数量，等于二则退出
        if (i>=actionBtns.length&&doneCount>=2) {
          debugInfo('已完成挑战任务')
          challengeDone = true
          //检查是否尚未关闭任务窗口，是则关闭
          let descText = widgetUtils.widgetGetOne('^距结束仅剩$', 3000)
          if (descText) {
            let closeBtn = descText.parent().parent().child(0)
            if (closeBtn) {
              automator.clickRandom(closeBtn)
              sleep(2000)
            }
          }
          break
        }
      }
    }
    
    let fertilizeTimeView = widgetUtils.widgetGetOne('^\\d+次.*|我的合种>$', 3000)
    if (fertilizeTimeView) {
      LogFloaty.pushWarningLog('找到施肥次数控件, 自动施肥')
      let fertilizeTimes = 0
      let fertilizeTimesRegex = /^(\d+)次.*$/
      if (fertilizeTimesRegex.test(fertilizeTimeView.text())) {
        fertilizeTimes = fertilizeTimesRegex.exec(fertilizeTimeView.text())[1]
      }
      let lastFertilizeTime = fertilizeTimes
      while (challengeDone && fertilizeTimes<80) {
        doFertilizeOnce()
        fertilizeTimeView = widgetUtils.widgetGetOne('^\\d+次.*$', 3000)
        if (fertilizeTimeView) {
          fertilizeTimes=fertilizeTimesRegex.exec(fertilizeTimeView.text())[1]
        }
        debugInfo('施肥次数：'+fertilizeTimes)
        if (fertilizeTimes==lastFertilizeTime) {
          debugInfo('施肥次数没有变化，说明有问题，退出施肥操作')
          break
        }
      }
    }
    
    return true
  }

  this.openAlipayFarmTaskWindow = function () {
    let taskBtn = widgetUtils.widgetGetOne('^任务列表$', 3000)
    if (taskBtn) {
      automator.clickRandom(taskBtn)
    } else {
      FloatyInstance.setFloatyText('通过文字查找每日任务入口失败')
      if (!this.captureAndCheckByOcr('^领肥料$', '每日任务入口：领肥料', null, null, true)) {
        FloatyInstance.setFloatyText('通过OCR查找入口失败')
        if (!this.captureAndCheckByImg(bb_farm_config.task_btn_alipay, '每日任务', null, true)) {
          FloatyInstance.setFloatyText('通过图片查找每日任务入口失败')
          this.execFailed = true
          return false
        }
      }
    }
    sleep(3000)
    return true
  }
  
  //完成支付宝芭芭农场任务
  this.collectAlipayTask = function () {
    if (!this.openAlipayFarmTaskWindow()) {
      return false
    }
    
    let hasTask = false
    let limit = 10
    while (!widgetUtils.widgetCheck('前往手机淘宝.*芭芭农场', 1000) && limit-- > 0) {
        randomScrollDown()
        sleep(1000)
    }

    let taskInfos = [
      {btnRegex:'去逛逛', tasks:[
        {taskType:'browse',titleRegex:'.*逛好物最高得1000肥料.*\\d+/\\d+.*',timeout:30,needScroll:true},
        {taskType:'browse',titleRegex:'.*逛一逛支付宝会员.*\\d+/\\d+.*',timeout:3,needScroll:false},
        {taskType:'app',titleRegex:'.*逛逛淘宝芭芭农场.*\\d+/\\d+.*',timeout:15,needScroll:false},
        {taskType:'app',titleRegex:'.*去天猫攒福气兑红包.*\\d+/\\d+.*',timeout:15,needScroll:false},
      ]},
      {btnRegex:'捉小鸡', tasks:[
        {taskType:'doCatchChicks',titleRegex:'.*一键捉小鸡赚肥料'},
      ]},
      {btnRegex:'去完成', tasks:[
        {taskType:'doBrowseAndCollect',titleRegex:'.*逛好物最高得2000肥料.*\\d+/\\d+.*'},
        {taskType:'browse',titleRegex:'.*逛一逛得1500肥料.*\\d+/\\d+.*',timeout:15,needScroll:true},
        {taskType:'browse',titleRegex:'.*(逛|看)精选商品.*\\d+/\\d+.*',timeout:15,needScroll:true},
        {taskType:'browse',titleRegex:'.*逛.*好货得肥料.*\\d+/\\d+.*',timeout:15,needScroll:true},
        {taskType:'browse',titleRegex:'.*逛金秋出游好去处.*\\d+/\\d+.*',timeout:15,needScroll:true},
        {taskType:'browse',titleRegex:'.*逛一逛支付宝运动.*\\d+/\\d+.*',timeout:3,needScroll:false},
        {taskType:'app',titleRegex:'.*逛一逛快手.*\\d+/\\d+.*',timeout:10,needScroll:false},
        {taskType:'app',titleRegex:'.*去点淘赚元宝提现.*\\d+/\\d+.*',timeout:15,needScroll:false},
        {taskType:'app',titleRegex:'.*逛淘宝看视频领现金.*\\d+/\\d+.*',timeout:15,needScroll:false},
        {taskType:'app',titleRegex:'.*逛饿了么.*\\d+/\\d+.*',timeout:15,needScroll:false},
        {taskType:'app',titleRegex:'.*逛一逛抖音极速版.*\\d+/\\d+.*',timeout:3,needScroll:false},
      ]},
    ]
  
    do {
      hasTask = false
      for (let i = 0; i < taskInfos.length && !this.execFailed; i++) {
        let taskInfo = taskInfos[i]
        let btns = widgetUtils.widgetGetAll(taskInfo.btnRegex, 3000)
        if (btns && btns.length > 0) {
          btns.forEach(btn => {
            if (this.execFailed) {
              debugInfo('当前脚本执行失败，跳过执行')
              return false
            }

            let titleObj = commonFunctions.getTaskTitleObj(btn,1)
            if (titleObj) {
              let titleText = titleObj.text()
              LogFloaty.pushLog('发现任务：'+titleText)
              for (let j = 0; j < taskInfo.tasks.length; j++) {
                let task = taskInfo.tasks[j]
                if (titleText.match(task.titleRegex)) {
                  LogFloaty.pushLog('开始执行任务：'+titleText)
                  if (task.taskType == 'browse') {
                    hasTask = this.doCommonTask('BBFarm.alipay', titleText, btn, task.timeout, task.needScroll) || hasTask
                  } else if (task.taskType == 'app') {
                    hasTask = this.doCommonTask('BBFarm.alipay', titleText, btn, task.timeout, task.needScroll) || hasTask
                  } else {
                    hasTask = this.doSpecialTask(task.taskType, titleObj, btn) || hasTask
                  }
                  this.backToTaskUI('BBFarm.alipay')
                  break
                }
              }
            }
          })
        }
      }
    } while (hasTask && !this.execFailed)
    scrollUpTop()

    sleep(1000)
    let collects = widgetUtils.widgetGetAll('^领取$')
    if (collects && collects.length > 0) {
      debugInfo('找到可领取的奖励：' + collects.length)
      for (let i = 0; i < collects.length; i++) {
        //automator.clickRandom(collects[i])
        collects[i].click()
        sleep(1000)
      };
    }
    
    //关闭每日任务界面
    let closeBtn = widgetUtils.widgetGetOne('关闭',1000,false,false,m => m.boundsInside(0,  config.device_height * 0.2, config.device_width, config.device_height))
    if (closeBtn) {
      automator.clickRandom(closeBtn)
    } else {
      //点击空白处关闭界面
      automator.clickPointRandom(150,300)
    }
    sleep(1000)

    return true
  }

  /**
   * 检查是否已进入淘宝芭芭农场
   * @returns boolean
   * */
  this.checkIsInTaobaoFarm = function (timeout) {
    timeout = timeout || 2000
    let checkResult = widgetUtils.widgetCheck('芭芭农场，免费领水果，助果农增收',timeout)
    if (!checkResult) {
      checkResult = this.checkForTargetImg(bb_farm_config.entry_check_taobao, '农场加载校验')
    }
    return checkResult
  }

  this.openTaobaoFarm = function () {
    debugInfo('前往手机淘宝-芭芭农场')
    
    let _package_name = 'com.taobao.taobao'
    app.launch(_package_name)
    sleep(5000)
    FloatyInstance.setFloatyText('校验是否有打开确认弹框')
    let startTime = new Date().getTime()
    while (new Date().getTime() - startTime < 30000) {
      let confirm = widgetUtils.widgetGetOne(/^打开|允许$/, 1000)
      if (confirm) {
        this.displayButtonAndClick(confirm, '找到了打开按钮')
      } else {
        FloatyInstance.setFloatyText('没有打开确认弹框')
      }

      //检查是否有弹窗
      this.checkAndClosePopup()
      //检查是否有验证窗口，有则等待直到消失
      commonFunctions.waitForTBVerify()

      let entry = widgetUtils.widgetGetOne('^芭芭农场$', 3000)
      if (!entry) {
        let btnMytaobao = widgetUtils.widgetGetOne('^我的淘宝$', 3000);
        if (btnMytaobao) {
          automator.clickRandom(btnMytaobao)
          sleep(2000)
          entry = widgetUtils.widgetGetOne('^芭芭农场$', 3000)
        }
      }
      if (entry) {
        FloatyInstance.setFloatyText('打开淘宝芭芭农场')
        sleep(1000)
        automator.clickRandom(entry)
        sleep(1000)

        //检查是否有弹窗
        this.checkAndClosePopup()
        if (this.checkIsInTaobaoFarm()) {
          FloatyInstance.setFloatyText('已进入淘宝农场')
          return true
        }
      }
      sleep(1000)
    }
    return false
  }

  this.executeTaobaoFarm = function () {
    if (this.execFailed) {
      debugInfo('当前脚本执行失败，跳过执行')
      return false
    }
    
    let execResult = this.openTaobaoFarm()
    if (execResult) {
      if (!this.captureAndCheckByImg(bb_farm_config.collect_btn_taobao, '每日签到', null, true, 1)) {
        this.captureAndCheckByOcr('点击领取', '每日签到', [config.device_width/2,config.device_height/2,config.device_width/2,config.device_height/2], null, true, 1)
      }
  
      execResult = execResult && this.collectTaobaoTask()
    }
    if (!execResult) {
      debugInfo('淘宝芭芭农场执行失败，5分钟后重试')
      this.execFailed = true
    }
    commonFunctions.minimize()
    return execResult
  }

  this.answerQuestionTBFarm = function (titleObj,entryBtn) {
    let ai_type = config.ai_type || 'chatgml'
    let kimi_api_key = config.kimi_api_key
    let chatgml_api_key = config.chatgml_api_key || '5f5dd3945ca42bdbe8c098631951823f.bseSZ5KGQUfWOzBD'
    let key = ai_type === 'kimi' ? kimi_api_key : chatgml_api_key
    if (!key) {
      LogFloaty.pushLog('推荐去KIMI开放平台申请API Key并在可视化配置中进行配置')
      LogFloaty.pushLog('否则免费接口这个智障AI经常性答错')
    }
    let result = false
    if (entryBtn) {
      LogFloaty.pushLog('等待进入 '+titleObj.text())
      entryBtn.click()
      sleep(3000)
      
      let title = widgetUtils.widgetGetOne('氛围',2000,null,null,m=>m.className('android.widget.Image'))
      let questionRoot = null
      let closeBtn = null
      if (title) {
        closeBtn = title.parent().child(1)
        questionRoot = title.parent().child(2)
      }
      result = AiUtil.getQuestionInfo(ai_type, key, questionRoot, 'tbfarm')
      if (result) {
        LogFloaty.pushLog('答案解释：' + result.describe)
        LogFloaty.pushLog('答案坐标：' + JSON.stringify(result.target))
        automator.clickPointRandom(result.target.x, result.target.y)
        sleep(3000)
        getBtn = widgetUtils.widgetGetOne('领取.+\\d+', 3000, false, false, m => m.boundsInside(0,  config.device_height/2, config.device_width, config.device_height))
        if (getBtn) {
          // automator.clickRandom(getBtn)
          getBtn.click()
          sleep(1000)
          //重新打开任务界面
          this.openTaobaoFarmTaskWindow()
          return true
        }
      }
      // TODO 随机答题
      automator.clickRandom(closeBtn)
      sleep(1000)
    }
    return !!result
  }

  //收集亲密度奖励
  this.collectFriendIntimacyTask = function () {
    //查找亲密度入口
    let familyEntry = widgetUtils.widgetGetOne('^芭芭农场，免费领水果，助果农增收$',1000)
    if (familyEntry) {
      //进入亲密度界面
      automator.clickRandom(familyEntry)
      sleep(2000)
      let titleView = widgetUtils.widgetGetOne('^合种亲密度$',2000)
      if (titleView) {
        let titleDepth = titleView.depth()
        let collectBtns = widgetUtils.widgetGetAll('^立即领取$',3000,false,m=>m.depth(titleDepth+2))
        if (collectBtns && collectBtns.length > 0) {
          //领取亲密度奖励
          collectBtns.forEach(function (btn) {
            automator.clickRandom(btn)
            sleep(1000)
          });
        }
        //关闭亲密度界面
        let closeBtn = widgetUtils.widgetGetOne('^立即领取$',2000,false,true,m=>m.depth(titleDepth))
        if (closeBtn) {
          automator.clickRandom(closeBtn)
        } else {
          //点击空白处关闭界面
          automator.clickRandom(familyEntry)
        }
        sleep(1000)
      }
    }
  }

  //收集兔子和好友奖励
  this.collectFriendTask = function () {
    //查找兔子位置
    let rabbitRegion = null
    let collectBtn = this.captureAndCheckByOcr('^点击领取|明日7点可领$', '每日签到', [config.device_width/2,config.device_height/2,config.device_width/2,config.device_height/2], false, false, 1)
    if (collectBtn) {
      rabbitRegion = [config.device_width - collectBtn.right + 50,collectBtn.top - 80,collectBtn.width() - 50, 20]
      warningFloaty.addRectangle('兔子位置',rabbitRegion)
      automator.clickRandomRegion(rabbitRegion)
      sleep(1000)
    }
    
    //查找好友林入口
    let friendEntry = widgetUtils.widgetGetOne('^好友林$',2000)
    if (friendEntry) {
      //进入好友林界面
      automator.clickRandom(friendEntry)
      sleep(2000)
      let collectBtns = widgetUtils.widgetGetAll('^肥料 \\d+$',3000)
      if (collectBtns && collectBtns.length > 0) {
        //领取好友林奖励
        collectBtns.forEach(function (collectBtn) {
          collectBtn.click()
          sleep(1000)
        })
      }
      automator.back()
      sleep(1000)
    }
  }
  
  //搜索浏览任务
  this.doSearchAndBrowse = function (titleObj,entryBtn) {
    let result = false
    if (entryBtn) {
      let titleText = titleObj? titleObj.text() : entryBtn.text()
      LogFloaty.pushLog('等待进入 '+titleText)
      entryBtn.click()
      sleep(3000)
          
      let listView = className('android.widget.ListView').findOne(5000)
      if (listView && listView.childCount()>0) {
        let listItem = listView.child(0)
        if (listItem) {
          automator.clickRandom(listItem)
          sleep(5000)

          LogFloaty.pushLog(titleText+' 等待倒计时结束')
          let limit = 15
          while ((limit-- > 0)) {
            LogFloaty.replaceLastLog(titleText+' 等待倒计时结束 剩余：' + limit + 's')
            if (limit % 2 == 0) {
              automator.scrollUpAndDown()
              sleep(100)
            } else {
              sleep(1000)
            }
          }
          automator.back()
          sleep(1000)
          result = true
        }
      }
      automator.back()
      sleep(1000)
    }
    return result
  }

  this.openTaobaoFarmTaskWindow = function () {
    // 查找每日任务入口
    if (!this.captureAndCheckByOcr('^集肥料$', '每日任务入口：集肥料', null, null, true)) {
      FloatyInstance.setFloatyText('通过OCR查找入口失败')
      if (!this.captureAndCheckByImg(bb_farm_config.task_btn_taobao, '每日任务', null, true)) {
        FloatyInstance.setFloatyText('通过图片查找每日任务入口失败')
        return false
      }
    }
    sleep(3000)
    return true
  }

  // 收集淘宝肥料
  this.collectTaobaoTask = function () {
    
    this.collectFriendIntimacyTask()
    
    this.collectFriendTask()
    
    //检查是否有弹窗
    this.checkAndClosePopup()

    if (!this.openTaobaoFarmTaskWindow()) {
      return false
    }

    let collect = widgetUtils.widgetGetOne('去签到',1000)
    if (collect) {
      FloatyInstance.setFloatyInfo({ x: collect.bounds().x, y: collect.bounds().y }, '去签到')
      automator.clickRandom(collect)
      sleep(1000)
    }

    let hasTask = false
    let limit = 10
    while (!widgetUtils.widgetCheck('领肥料礼包.*|领肥料小提示.*', 1000) && limit-- > 0) {
        randomScrollDown()
        sleep(1000)
    }

    let taskInfos = [
      {btnRegex:'去答题', tasks:[
        //     农场百科问答(0/1)：领奖励500
        {taskType:'answerQuestionTBFarm',titleRegex:'农场百科问答.*'},
      ]},
      {btnRegex:'去浏览', tasks:[
        //     浏览金币小镇得肥料：15s返回
        {taskType:'browse',titleRegex:'浏览金币小镇.*\\d+/\\d+.*',timeout:15,needScroll:true},
        //     观看直播得奖励：15s返回
        {taskType:'browse',titleRegex:'(观看|浏览)直播.*\\d+/\\d+.*',timeout:15,needScroll:true},

        {taskType:'app',titleRegex:'.*逛逛淘宝芭芭农场.*\\d+/\\d+.*',timeout:15,needScroll:false},
        {taskType:'app',titleRegex:'.*去天猫攒福气兑红包.*\\d+/\\d+.*',timeout:15,needScroll:false},
      ]},
      {btnRegex:'去完成', tasks:[
        //     搜一搜你喜欢的商品(0/1)：猜你想搜（ListView）
        //         滑动浏览得肥料|任务完成|下单最高可得肥料
        //     搜一搜你心仪的宝贝：猜你想搜（ListView）
        //         浏览得肥料|浏览完成|立即下单最高得肥料
        {taskType:'doSearchAndBrowse',titleRegex:'搜一搜.*\\d+/\\d+.*',timeout:15,needScroll:true},
        //     看看磨砂桌垫：滑动浏览得肥料|任务完成|立即下单最高得肥料
        //     看严选推荐商品：滑动浏览\n得肥料|任务完成
        //     看看夺命大乌苏：浏览得肥料|浏览完成|立即下单最高得肥料
        {taskType:'browse',titleRegex:'看.*\\d+/\\d+.*',timeout:15,needScroll:true},
        //     逛精选好物：滑动浏览得肥料|任务完成|下单最高可得肥料
        //     逛精选好货：浏览得肥料|浏览完成|立即下单最高得肥料
        {taskType:'browse',titleRegex:'逛精选.*\\d+/\\d+.*',timeout:15,needScroll:true},
        //     观看直播得奖励：15s返回
        {taskType:'browse',titleRegex:'(观看|浏览)直播.*\\d+/\\d+.*',timeout:15,needScroll:true},
        //     浏览优衣库官方旗舰店(0/5)：15滑动返回
        {taskType:'browse',titleRegex:'浏览.+\\d+/\\d+.*',timeout:15,needScroll:true},
        //   去点淘领每日提现红包：15秒后返回
        {taskType:'app',titleRegex:'.*去点淘.*\\d+/\\d+.*',timeout:15,needScroll:false},
        //     去蚂蚁新村收木兰币：直接返回
        {taskType:'app',titleRegex:'去蚂蚁新村.*\\d+/\\d+.*',timeout:3,needScroll:false},
        //     去一淘签到每天领现金：直接返回
        {taskType:'app',titleRegex:'去一淘.*\\d+/\\d+.*',timeout:3,needScroll:false},
        //     去快手app领福利：直接返回
        {taskType:'app',titleRegex:'去快手.*\\d+/\\d+.*',timeout:3,needScroll:false},
        //     逛逛支付宝芭芭农场：直接返回
        {taskType:'app',titleRegex:'逛逛支付宝.*\\d+/\\d+.*',timeout:3,needScroll:false},
        //     去天猫领现金最高7元：直接返回
        {taskType:'app',titleRegex:'去天猫.*\\d+/\\d+.*',timeout:15,needScroll:false},
        //     去闲鱼币领现金红包：直接返回
        {taskType:'app',titleRegex:'去闲鱼.*\\d+/\\d+.*',timeout:15,needScroll:false},
      ]},
    ]
  
    do {
      hasTask = false
      for (let i = 0; i < taskInfos.length && !this.execFailed; i++) {
        let taskInfo = taskInfos[i]
        let btns = widgetUtils.widgetGetAll(taskInfo.btnRegex, 3000)
        if (btns && btns.length > 0) {
          btns.forEach(btn => {
            if (this.execFailed) {
              debugInfo('当前脚本执行失败，跳过执行')
              return false
            }

            let titleObj = commonFunctions.getTaskTitleObj(btn,2)
            if (titleObj) {
              let titleText = titleObj.text()
              LogFloaty.pushLog('发现任务：'+titleText)
              for (let j = 0; j < taskInfo.tasks.length; j++) {
                let task = taskInfo.tasks[j]
                if (titleText.match(task.titleRegex)) {
                  LogFloaty.pushLog('开始执行任务：'+titleText)
                  if (task.taskType == 'browse') {
                    hasTask = this.doCommonTask('BBFarm.taobao', titleText, btn, task.timeout, task.needScroll) || hasTask
                  } else if (task.taskType == 'app') {
                    hasTask = this.doCommonTask('BBFarm.taobao', titleText, btn, task.timeout, task.needScroll) || hasTask
                  } else {
                    hasTask = this.doSpecialTask(task.taskType, titleObj, btn) || hasTask
                  }
                  this.backToTaskUI('BBFarm.taobao')
                  break
                }
              }
            }
          })
        }
      }
    } while (hasTask && !this.execFailed)
    scrollUpTop()

    let collects = widgetUtils.widgetGetAll('^.*领取$',3000)
    if (collects && collects.length > 0) {
      debugInfo('找到可领取的奖励：' + collects.length)
      for (let i = 0; i < collects.length; i++) {
        // automator.clickRandom(collects[i])
        collects[i].click()
        sleep(1000)
      };
    } else {
      debugInfo('没有找到可领取的奖励')
    }

    return true
  }

  this.checkAndClosePopup = function () {
    //检查是否有弹窗
    let popupCancelBtn = widgetUtils.widgetGetOne("^继续努力|退出比赛|取消|忽略|关闭|拒绝$", 3000, false, false, m => m.boundsInside(0,  config.device_height * 0.2, config.device_width, config.device_height))
    if (popupCancelBtn) {
      debugInfo('找到了弹窗取消按钮')
      automator.clickRandom(popupCancelBtn)
      sleep(1000)
    }
  }
}

let randomTop = {start:config.device_height/2-50, end:config.device_height/2+50}
let randomBottom= {start:config.device_height * 0.85 - 50, end:config.device_height * 0.85 + 10}

function randomScrollDown () {
  automator.randomScrollDown(randomBottom.start, randomBottom.end, randomTop.start, randomTop.end)
}

function randomScrollUp (isFast) {
  automator.randomScrollUp(randomTop.start, randomTop.end, randomBottom.start, randomBottom.end, isFast)
}

function scrollUpTop () {
  let limit = 5
  do {
    randomScrollUp(true)
  } while (limit-- > 0)
}

SignRunner.prototype = Object.create(BaseSignRunner.prototype)
SignRunner.prototype.constructor = SignRunner

module.exports = new SignRunner()
