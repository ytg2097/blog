---
sidebar: auto
---

# 使用Docker buildx构架多架构镜像

新入手了一台arm架构的mbp，在打包镜像发布到公司的容器云平台时遇到了兼容性问题，特记录一下解决方法。

查看容器日志得到以下错误

> standard_init_linux.go:228: exec user process caused: exec format error

查看镜像信息

```bash
[yangtg@dce-10-20-24-11 ~]$ sudo docker inspect 84a1
[
				...
        "Architecture": "arm64",
        "Os": "linux",
				...
]
```

镜像的系统架构为arm64，而k8s集群为amd64。原因找到，修改镜像架构为amd即可。

---

#### 前言

大部分发行镜像一个标签下都会存在多个不同架构的镜像版本， 比如openjdk，就同时存在amd与arm两个版本镜像。

![image-20211222163506210](https://image.ytg2097.com/image-20211222163506210.png)

在执行`docker pull`或`docker run`时， docker会自动根据当前系统架构去拉取相同架构的镜像。

---

#### 使用Docker buildx

那么我们如何去构建多架构的镜像呢？

默认的`docker build` 是不支持构架跨平台镜像的，但在 Docker 19.03+ 版本中可以使用 `docker buildx build` 命令使用 `BuildKit` 构建镜像。该命令支持 `--platform` 参数可以同时构建支持多种系统架构的 Docker 镜像。使用`docker buildx build`命令的`--platform`参数可以指定要构建哪种架构的镜像。

在macOS，windows，和linux发行版的docker中都内置了`docker buildx`，不需要再重新安装。

由于docker默认的builder实例默认不支持同时指定多个`--platform`， 所以首先需要创建一个builder实例。

> 创建builder实例

```bash
ytg@yangtonggangdeMacBook-Pro bin % docker buildx create --use --name=mutil-platform-builder 
mutil-platform-builder
ytg@yangtonggangdeMacBook-Pro bin % docker buildx ls
NAME/NODE                 DRIVER/ENDPOINT             STATUS   PLATFORMS
mutil-platform-builder *  docker-container
  mutil-platform-builder0 unix:///var/run/docker.sock inactive
desktop-linux             docker
  desktop-linux           desktop-linux               running  linux/arm64, linux/amd64, linux/riscv64, linux/ppc64le, linux/s390x, linux/386, linux/arm/v7, linux/arm/v6
default                   docker
  default                 default                     running  linux/arm64, linux/amd64, linux/riscv64, linux/ppc64le, linux/s390x, linux/386, linux/arm/v7, linux/arm/v6
ytg@yangtonggangdeMacBook-Pro bin % docker buildx use mutil-platform-builder
```

#### 测试

写一个简单的helloworld测试一下， 代码如下：

> Main.go

```go
package main

import (
        "fmt"
        "runtime"
)

func main() {
        fmt.Println("Hello world!")
        fmt.Printf("Running in [%s] architecture.\n", runtime.GOARCH)
}
```

> Dockerfile

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.17 as builder

ARG TARGETARCH

WORKDIR /app
COPY main.go /app/main.go
RUN GOOS=linux GOARCH=$TARGETARCH go build -a -o output/main main.go

FROM alpine:latest
WORKDIR /root
COPY --from=builder /app/output/main .
CMD /root/main
```

打包镜像

```bash
ytg@yangtonggangdeMacBook-Pro GolandProjects % docker buildx build --platform linux/arm64,linux/amd64 -t ytg2097/buildx-test:0.1 .
WARN[0000] No output specified for docker-container driver. Build result will only remain in the build cache. To push result image into registry use --push or to load image into docker use --load
```

提示`No output specified for docker-container driver.`，之后`docker images`也没有刚刚打包的镜像，这是因为buildx会将`--platfrom`中指定的所有平台的构建结果合并为一个整体的镜像列表输出， 因此无法直接输出到本地的images里。

所以我们需要指定一个buildx的输出方式， buildx支持一下几种输出方式：

- local：构建结果将以文件系统格式写入 `dest` 指定的本地路径， 如 `--output type=local,dest=./output`。
- tar：构建结果将在打包后写入 `dest` 指定的本地路径。
- oci：构建结果以 OCI 标准镜像格式写入 `dest` 指定的本地路径。
- docker：构建结果以 Docker 标准镜像格式写入 `dest` 指定的本地路径或加载到 `docker` 的镜像库中。同时指定多个目标平台时无法使用该选项。
- image：以镜像或者镜像列表输出，并支持 `push=true` 选项直接推送到远程仓库，同时指定多个目标平台时可使用该选项。
- registry：`type=image,push=true` 的精简表示。

这里我直接推送到我的镜像仓库中去， 完整的命令如下

```bash
docker buildx build --platform linux/arm64,linux/amd64 -t ytg2097/buildx-test:0.1  -o type=registry .
```

![image-20211222172124018](https://image.ytg2097.com/image-20211222172124018.png)

---

打包之后到dockerhub查看刚刚push的镜像

![image-20211222172607971](https://image.ytg2097.com/image-20211222172607971.png)

仓库中同时存在amd64和arm64架构的两个版本，pull或者run时可以指定sha256来拉取特定架构的镜像。

```bash
docker run --rm ytg2097/buildx-demo:0.1@sha256=e7c8f88eff9280ec107cf6b223c9982a87e387eef27b6c790a9264dec5d2928d
```

也可以在本地通过`docker buildx imagetools inspect ytg2097/buildx-demo:0.1 ` 查看

![image-20211222173200369](https://image.ytg2097.com/image-20211222173200369.png)