# rw-proxy 构建说明

这份文档说明当前 `rw-proxy` 项目在本机的实际构建方式。

适用目录：

`E:\codex-project\rw-middle-api`

## 1. 项目结构

- 后端：Go
- 前端：`web/` 目录，Vite 构建
- 前端产物：`web/dist`
- 最终本地运行文件：`new-api-local.exe`

注意：

`main.go` 使用了 `go:embed web/dist`，所以**只改前端是不够的**。

前端改完后，必须：

1. 先重新构建 `web/dist`
2. 再重新构建 Go 二进制
3. 最后重启服务

否则服务仍然会继续使用旧的前端资源。

## 2. 本机前置条件

当前机器上已经验证过的环境：

- Node.js / npm 可用
- Go 安装在：`E:\codex-tools\go`
- SQLite 数据库使用：`E:\codex-project\rw-middle-api\data\one-api.db`

项目根目录已经有 `.env`：

```env
SQLITE_PATH=E:\codex-project\rw-middle-api\data\one-api.db?_busy_timeout=30000
```

这意味着：

- 直接启动 `new-api-local.exe` 时，会自动连到 `data\one-api.db`
- 不会再误连到根目录下的空库 `one-api.db`

## 3. 前端构建

进入项目根目录后执行：

```powershell
cd E:\codex-project\rw-middle-api
npm --prefix .\web run build
```

如果是首次拉代码，还没有安装前端依赖，先执行：

```powershell
cd E:\codex-project\rw-middle-api
npm --prefix .\web install
npm --prefix .\web run build
```

说明：

- 构建完成后，前端产物会更新到 `web/dist`
- 这一步只会更新静态资源，还不会更新运行中的服务

## 4. 后端构建

如果系统里 `go` 没有加到 PATH，可以用下面这组命令：

```powershell
$env:GOROOT='E:\codex-tools\go'
$env:PATH="E:\codex-tools\go\bin;" + $env:PATH
$env:GOPATH='E:\codex-tools\gopath'
$env:GOCACHE='E:\codex-tools\gocache'
$env:GOTMPDIR='E:\codex-tools\gotmp'

cd E:\codex-project\rw-middle-api
E:\codex-tools\go\bin\go.exe build -o .\new-api-local.exe .
```

如果你的 `go` 已经在 PATH 里，也可以直接：

```powershell
cd E:\codex-project\rw-middle-api
go build -o .\new-api-local.exe .
```

## 5. 启动服务

在项目根目录执行：

```powershell
cd E:\codex-project\rw-middle-api
.\new-api-local.exe
```

默认启动地址：

`http://localhost:3000`

## 6. 后台启动方式

如果你想像我们平时联调一样后台启动并落日志，可以用：

```powershell
cd E:\codex-project\rw-middle-api

$proc = Start-Process `
  -FilePath 'E:\codex-project\rw-middle-api\new-api-local.exe' `
  -WorkingDirectory 'E:\codex-project\rw-middle-api' `
  -WindowStyle Hidden `
  -RedirectStandardOutput 'E:\codex-project\rw-middle-api\run.log' `
  -RedirectStandardError 'E:\codex-project\rw-middle-api\run.err.log' `
  -PassThru

$proc.Id
```

日志文件：

- `run.log`
- `run.err.log`

## 7. 停止服务

如果知道 PID：

```powershell
Stop-Process -Id <PID> -Force
```

如果想按进程名结束：

```powershell
Get-Process new-api-local -ErrorAction SilentlyContinue | Stop-Process -Force
```

## 8. 标准构建顺序

每次改完代码，推荐固定按这个顺序来：

1. 前端改动
2. 执行前端构建
3. 执行 Go 构建
4. 停掉旧服务
5. 启动新服务
6. 浏览器 `Ctrl+F5` 强刷页面

对应命令可以简化成：

```powershell
cd E:\codex-project\rw-middle-api

npm --prefix .\web run build

$env:GOROOT='E:\codex-tools\go'
$env:PATH="E:\codex-tools\go\bin;" + $env:PATH
$env:GOPATH='E:\codex-tools\gopath'
$env:GOCACHE='E:\codex-tools\gocache'
$env:GOTMPDIR='E:\codex-tools\gotmp'

Get-Process new-api-local -ErrorAction SilentlyContinue | Stop-Process -Force
E:\codex-tools\go\bin\go.exe build -o .\new-api-local.exe .
.\new-api-local.exe
```

## 9. 常见问题

### 9.1 页面改了但浏览器没变化

常见原因：

- 只 build 了前端，没有重新 build Go 后端
- 服务还在跑旧的 `new-api-local.exe`
- 浏览器没强刷缓存

排查顺序：

1. 确认 `web/dist` 已更新
2. 重新执行 `go build`
3. 重启服务
4. 浏览器 `Ctrl+F5`

### 9.2 token 明明在库里，但接口返回 401

重点检查是不是连错数据库。

当前正确数据库是：

`E:\codex-project\rw-middle-api\data\one-api.db`

如果误连成：

`E:\codex-project\rw-middle-api\one-api.db`

就会出现：

- 登录状态不一致
- token 查不到
- 模型和渠道配置丢失

### 9.3 聊天接口返回 503，提示 system disk overloaded

这是性能保护拦截，不是模型坏了。

当前机器如果系统盘占用过高，`/v1/chat/completions` 可能被拦。

处理方式：

- 清理磁盘空间
- 或在本地测试环境里关闭性能监控

### 9.4 登录后提示 session 无效

如果日志里出现：

`securecookie: the value is not valid`

通常是：

- 重启后旧 cookie 失效
- 浏览器保留了旧 session

处理方式：

- 重新登录
- 或清理浏览器站点 cookie

## 10. 当前推荐做法

对这台机器，最稳的做法就是：

- 前端：`npm --prefix .\web run build`
- 后端：`E:\codex-tools\go\bin\go.exe build -o .\new-api-local.exe .`
- 数据库：使用 `.env` 中的 `data\one-api.db`
- 服务：每次改完都重启

