---
sidebar: auto
prev: ./component
next: ./codec
---
# NettyServer端的初始化流程

先写一个通用的Netty服务端的启动代码, 而后逐步分析

```java 
public class NettyServer {

    private final EventLoopGroup parent;

    private final EventLoopGroup children;

    private final ServerBootstrap bootstrap;

    public NettyServer() {
        parent = new NioEventLoopGroup(1);
        children = new NioEventLoopGroup();

        bootstrap = new ServerBootstrap()
                .channel(NioServerSocketChannel.class)
                .group(parent, children)
                .handler(new LoggingHandler(LogLevel.INFO))
                .childHandler(new ChannelInitializer<ServerChannel>() {
                    @Override
                    protected void initChannel(ServerChannel ch) throws Exception {
                        ch.pipeline();
                        // 添加自定义handler...
                    }
                });


    }

    public ChannelFuture bind(int port) throws InterruptedException {
        try {
            return bootstrap.bind(port).sync();
        } catch (InterruptedException e) {
            parent.shutdownGracefully();
            children.shutdownGracefully();
            throw e;
        }
    }

    public static void main(String[] args) throws InterruptedException {

        new NettyServer().bind(9989);
    }
}
```

## EventLoopGroup初始化流程

## Channel配置

## EventLoop分配

## 初始化Channel

## 绑定端口


