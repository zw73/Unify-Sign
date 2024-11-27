let { config } = require('../config.js')(runtime, global)
let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, global)
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

function test1() {
      //查找一键丢肥料按钮
      let oneKeyBtn = widgetUtils.widgetGetOne(/^一键丢肥料.*/, 5000)
      //查找勾选5条选项
      let fiveBtn = widgetUtils.widgetGetOne(/^勾选5条$/, 1000)
      //点击一次丢肥料按钮
      if (oneKeyBtn) {
        debugInfo(['点击一次丢肥料按钮'])
        // automator.clickRandom(oneKeyBtn)
        sleep(1000)
      }
      //依次点击勾选5条按钮和丢肥料按钮，重复4次
      if (oneKeyBtn && fiveBtn) {
        for (let i = 0; i < 4; i++) {
          debugInfo(['第{}次点击勾选5条按钮和丢肥料按钮', i + 1])
        //   automator.clickRandom(fiveBtn)
          sleep(1000)
        //   automator.clickRandom(oneKeyBtn)
          sleep(1000)
        }
      }
}
function test2() {
    //加载图片文件 1724644438136100.jpg
    let img = images.read('../../1724644438136100.jpg')
    //OCR 识别图片，查找文本“一键收”并点击找到的区域
    debugInfo(['尝试ocr识别一键收'])
    let ocrCheck = localOcrUtil.recognizeWithBounds(img, null, '一键收')
    if (ocrCheck && ocrCheck.length > 0) {
      let bounds = ocrCheck[0].bounds
      debugInfo(['识别结果：{}', JSON.stringify(bounds)])
      try {
        debugInfo(['{} {} {} {}', bounds.left, bounds.top, bounds.width(), bounds.height])
      } catch (e) {

      }
      let region = [
        bounds.left, bounds.top,
        bounds.right - bounds.left, bounds.bottom - bounds.top
      ]
      debugInfo(['通过ocr找到了目标：{}', region])
      WarningFloaty.addRectangle('一键收', region)
    } else {
      warnInfo(['无法通过ocr找到一键收，可能当前有活动元素阻断'])
    }
    img.recycle()
}

function test3() {
  debugInfo('开始测试手势关闭app')
  recents()
  sleep(1000)
  console.log(device.brand)
  if (device.brand=='XIAOMI')
    gesture(320, [240, 1000], [800, 1000])
  else {
    if (device.brand=='HONOR') {
      gesture(320, [device.width / 4 * 3, device.height / 2], [device.width / 4, device.height / 2])
      sleep(500)
    }
    gesture(320, [device.width / 2, device.height / 2], [device.width / 2, 50])
  }
  sleep(500)
  back()
}

function randomNum (min, max) {
  return ~~(min + Math.random() * (max - min))
}

/**
* 真人模拟滑动函数
* 
* 传入值：起点终点坐标
* 效果：模拟真人滑动
*/
function randomSwipe(sx,sy,ex,ey){
  //设置随机滑动时长范围
  var timeMin=1000
  var timeMax=3000
  //设置控制点极限距离
  var leaveHeightLength=500
  
  if(Math.abs(ex-sx)>Math.abs(ey-sy)){
      var my=(sy+ey)/2
      var y2=my+random(0,leaveHeightLength)
      var y3=my-random(0,leaveHeightLength)
  
      var lx=(sx-ex)/3
      if(lx<0){lx=-lx}
      var x2=sx+lx/2+random(0,lx)
      var x3=sx+lx+lx/2+random(0,lx)
  }else{
      var mx=(sx+ex)/2
      var y2=mx+random(0,leaveHeightLength)
      var y3=mx-random(0,leaveHeightLength)

      var ly=(sy-ey)/3
      if(ly<0){ly=-ly}
      var y2=sy+ly/2+random(0,ly)
      var y3=sx+ly+ly/2+random(0,ly)
  }

  var time=[0,random(timeMin,timeMax)]
  var track=bezierCreate(sx,sy,x2,y2,x3,y3,ex,ey)
  
  log("控制点A坐标："+x2+","+y2)
  log("控制点B坐标："+x3+","+y3)
  log("滑动时长："+time[1])
  
  gestures(time.concat(track))
}

function test4() { 
  debugInfo('开始测试随机滑动')
  sleep(3000)
  let [x1,y1,x2,y2] = [randomNum(100,266),randomNum(1534,1658),randomNum(940,1040),randomNum(1529,1657),randomNum(970,1010)]
  debugInfo(['随机滑动：{} {} {} {} {}',x1,y1,x2,y2,dur])
  // automator.swipe(x1,y1,x2,y2,dur)
  automator.gesturePath({x:x1,y:y1},{x:x2,y:y2},dur)
}

function test5() {
  debugInfo('开始测试随机滑动')
  // let [x_start,startY,endX,endY,duration] = [randomNum(100,266),randomNum(1534,1658),randomNum(940,1040),randomNum(1529,1657),randomNum(970,1010)]
  // let delay_time = randomNum(1000,1500)
  while (true) {
    textContains("通过验证以确保正常访问").waitFor();
    // 滑动按钮“>>”位置
    idContains("nc_1_n1z").waitFor();
    var bound = idContains("nc_1_n1z").findOne().bounds();
    // 滑动边框位置
    text("向右滑动验证").waitFor();
    var slider_bound = text("向右滑动验证").findOne().bounds();

    // 通过更复杂的手势验证（向右滑动过程中途停顿）
    automator.gesturePath({x:bound.centerX(),y:bound.centerY()},{x:slider_bound.right,y:slider_bound.centerY()})
    // randomSwipe(bound.centerX(), bound.centerY(), slider_bound.right, slider_bound.centerY())

    sleep(2000);
    if (textContains("通过验证以确保正常访问").exists()) {
      sleep(1000);
      continue;
    }
    if (textContains("验证失败，点击框体重试").exists()) {
      debugInfo( "验证失败，点击框体重试" )
      textContains("验证失败，点击框体重试").findOne().click();
      sleep(1000);
      continue;
    }
    if (textContains("请刷新页面重试").exists()) {
      debugInfo( "验证失败，刷新页面重试" )
      automator.back();
      sleep(2000);
      continue;
    }
    // 执行脚本只需通过一次验证即可，防止占用资源
    // break;
    sleep(2000)
  }
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
      let collect = openCvUtil.findByImageSimple(images.cvtColor(images.grayscale(screen), 'GRAY2BGRA'), images.fromBase64(base64))
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

function test6() {
  debugInfo('打开领取体力和金币界面')
  let addTag = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAAAKHSURBVEiJtZY5b+MwEIU/UrRsCYkhuDcC5P//mrSuUriIEUeGdfPcIiDX8RVvsQ9goQHn4JvHocRmswn7/R6tNbfgvcday/F4pO97pJTkeY5SCiEEIYSbvkprjff+5gYAYwy73Y63tzfe39+Zz+e8vr6yXq9ZrVZ3fWXXdXcTOOeYponD4UDf9xhjGIaBuq6p6zpVH0K4utQ4jncr8N6noEIIFosFAOM40nXdXV8A+euOOxBC/N8E57jWbHVvs3MO7/1NldxTz68JvPeM45gSPYJrlKksyy6Mfd/T9z0hhKTzKOcYRCmFUooQAlLeZloBHI9HhmFIl20YBoZhQEpJlmVorWnbFmNMqtQ5xzAMfH5+XiQQQiRfZa1lu93y8fFB0zSJnliZlBLvPU3TYIxBCIEQAmMMdV1jrb2gKAbP8xxljGGz2bDb7S6aJqVMTqdJQwhYa2mahsPh8CN4pNw5h9b6e1S0bZtmzPlR48qyLB3de5+WtTb1KgY+vZxKa81isaAoipuyi4HPTxeH3im89zjn/ophmiZeXl54fn6mbduLINEpzqHIuVKKoih4enpKSgshME0TzjmklMxmM5QQgqqqKIoiqSRWHcfxNE1st1u+vr6YpgmA2WxGVVWs1+tElXMO51yiTEqJklJSliVlWV7Qkuc5QgjatmW/3yd5xmaWZclqtUoNvXYh1b1LEumw1qK1TlXCdzPjt9Y6STgi9vOhYZdlGcvlkvl8/sMeQsAYk96T03cg4qEEpzI9Rwx+a3TfHHbnQcZxTJr/FzyUIMJaS3wBo1pO6XkowbW/hKi0OD2jLcuyH3sjTac2dY27c1tsclVVdF1HCIHlcvlD2nGkRMQkfwDIO+0j2WCarAAAAABJRU5ErkJggg=='
  let screen = commonFunctions.captureScreen()
  debugInfo('准备截图查找目标：领取体力和金币按钮')
  let openBtns = images.matchTemplate(images.cvtColor(images.grayscale(screen), 'GRAY2BGRA'), images.fromBase64(addTag), {threshold:0.9, region: [0,0,config.device_width,350]})
  debugInfo(['匹配结果1：{}', JSON.stringify(openBtns)])
  openBtns = openBtns.points
  debugInfo(['匹配结果2：{}', JSON.stringify(openBtns)])
  if (openBtns && openBtns.length > 0) {
    openBtns.forEach(btn => {
      WarningFloaty.addRectangle('领取体力和金币', [btn.x, btn.y, 10, 10])
    })
  }
  sleep(10000)
}

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
  
        doBrowseTask()

        getBtn = captureAndCheckByOcr('领取','领取按钮',null,null,null,1)
        if (getBtn) {
          automator.clickRandom(getBtn)
          sleep(5000)
        }
      } else {
        debugInfo('未找到收集按钮')
      }
      WarningFloaty.clearAll()
    } while (freeTexts && freeTexts.length > 0)
      
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

function test7() {
  getFreeResource()
}

function test8() {
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
  for (let i = 0; i < taskInfos.length; i++) {
    let taskInfo = taskInfos[i]
    let btns = widgetUtils.widgetGetAll(taskInfo.btnRegex, 3000)
    if (btns && btns.length > 0) {
      btns.forEach(btn => {
        let titleObj = commonFunctions.getTaskTitleObj(btn,2)
        if (titleObj) {
          let titleText = titleObj.text()
          LogFloaty.pushLog('发现任务：'+titleText)
          for (let j = 0; j < taskInfo.tasks.length; j++) {
            let task = taskInfo.tasks[j]
            if (titleText.match(task.titleRegex)) {
              LogFloaty.pushLog('开始执行任务：'+titleText)
              sleep(1000)
              break
            }
          }
        } else {
          debugInfo('未找到任务标题')
        }
      })
    }
  }
}

test8()

