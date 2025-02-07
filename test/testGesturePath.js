// let { config } = require('../config.js')(runtime, global)
// let singletonRequire = require('../lib/SingletonRequirer.js')(runtime, global)
// let { logInfo, errorInfo, warnInfo, debugInfo, infoLog } = singletonRequire('LogUtils')

function debugInfo (message) {
  console.log(message)
}

// 路径生成测试

// 路径生成算法
function getRandomControlPoints(sx, sy, ex, ey) {
  let distance = Math.hypot(ex - sx, ey - sy)
  // 计算两点之间的距离（不使用Math.hypot）
  // let dx = ex - sx
  // let dy = ey - sy
  // let distance = Math.sqrt(dx * dx + dy * dy)
  let offset = Math.min(distance * 0.3, 200)
  
  let midX = (sx + ex) / 2
  let midY = (sy + ey) / 2
  
  let offsetX1 = (Math.random() - 0.5) * offset
  let offsetY1 = (Math.random() - 0.5) * offset
  let offsetX2 = (Math.random() - 0.5) * offset
  let offsetY2 = (Math.random() - 0.5) * offset

  return {
    controlX1: midX + offsetX1,
    controlY1: midY + offsetY1,
    controlX2: midX + offsetX2,
    controlY2: midY + offsetY2
  }
}

function bezierCreate(x1, y1, x2, y2, x3, y3, x4, y4) {
  let points = []
  let steps = 50
  
  if ((x2 === x1 && y2 === y1) || (x3 === x4 && y3 === y4)) {
    return [
      [x1, y1],
      [x4, y4]
    ]
  }

  let lastX = null, lastY = null
  
  for (let i = 0; i <= steps; i++) {
    let t = i / steps
    let u = 1 - t
    
    let x = u*u*u*x1 + 3*u*u*t*x2 + 3*u*t*t*x3 + t*t*t*x4
    let y = u*u*u*y1 + 3*u*u*t*y2 + 3*u*t*t*y3 + t*t*t*y4
    
    let roundedX = Math.round(x)
    let roundedY = Math.round(y)
    
    if (lastX === null || lastY === null || 
        roundedX !== lastX || roundedY !== lastY) {
      points.push([roundedX, roundedY])
      lastX = roundedX
      lastY = roundedY
    }
  }
  
  if (points.length < 2) {
    return [
      [x1, y1],
      [x4, y4]
    ]
  }
  
  return points
}

function generateRandomCubicBezierPath(x1, y1, x2, y2, numPoints) {
  let distance = Math.hypot(x2 - x1, y2 - y1)
  // 计算两点之间的距离（不使用Math.hypot）
  // let dx = x2 - x1
  // let dy = y2 - y1
  // let distance = Math.sqrt(dx * dx + dy * dy)
  let offset = Math.min(distance * 0.5, 300)
  
  debugInfo(`generateRandomCubicBezierPath: ${x1}, ${y1}, ${x2}, ${y2}, ${numPoints}`)
  let { controlX1, controlY1, controlX2, controlY2 } = getRandomControlPoints(x1, y1, x2, y2)
  debugInfo(`controlX1: ${controlX1}, controlY1: ${controlY1}, controlX2: ${controlX2}, controlY2: ${controlY2}`)  
  let points = bezierCreate(x1, y1, controlX1, controlY1, controlX2, controlY2, x2, y2)
  debugInfo(`points: ${points}`)
  
  let pointCount = Math.max(10, Math.min(50, Math.floor(distance / 10)))
  
  let step = Math.floor(points.length / pointCount)
  let result = []
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i])
  }
  
  if (!result.some(p => p[0] === x1 && p[1] === y1)) {
    result.unshift([x1, y1])
  }
  if (!result.some(p => p[0] === x2 && p[1] === y2)) {
    result.push([x2, y2])
  }
  
  return result
}

// 测试用例
function testPathGeneration() {
  // 测试1: 水平向右滑动
  let start1 = {x: 100, y: 800}
  let end1 = {x: 900, y: 800}
  let path1 = generateRandomCubicBezierPath(start1.x, start1.y, end1.x, end1.y, 50)
  debugInfo('水平向右滑动路径：'+JSON.stringify(path1))
  
  // 测试2: 垂直向下滑动  
  let start2 = {x: 500, y: 200}
  let end2 = {x: 500, y: 1600}
  let path2 = generateRandomCubicBezierPath(start2.x, start2.y, end2.x, end2.y, 50)
  debugInfo('垂直向下滑动路径：'+JSON.stringify(path2))
  
  // 测试3: 对角线滑动
  let start3 = {x: 100, y: 200}
  let end3 = {x: 900, y: 1600}
  let path3 = generateRandomCubicBezierPath(start3.x, start3.y, end3.x, end3.y, 50)
  debugInfo('对角线滑动路径：'+JSON.stringify(path3))
}

// 运行测试
testPathGeneration()
