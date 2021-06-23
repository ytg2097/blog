---
prev: ./proxy
next: ./cmd
---

# 模版方法模式

模版方法模式中, 会在抽象的基类中定义业务逻辑的执行顺序, 而后将其中一部分步骤的实现延迟到子类中去实现. 

![template](http://image.ytg2097.com/template.png)

几乎所有开源框架中都可以找到模版模式的使用案例. Netty框架就大量使用了模版方法模式. AOP其实也可以理解为模版方法模式. 切面中定义了针对切入点方法(模版方法)的增强逻辑, 所有的被切入的方法都可以看作是对模版方法的实现.

## Netty中的模版方法模式

Channel的生命周期状态变化决定了ChannelInBoundHandler中方法的执行顺序. ChannelInBoundHandler中提供了一系列的钩子方法供我们在Channel的某个特定事件发生时去执行特定的操作. 

```java 
public abstract class SimpleChannelInboundHandler<I> extends ChannelInboundHandlerAdapter {

    private final TypeParameterMatcher matcher;
    private final boolean autoRelease;

    protected SimpleChannelInboundHandler() {
        this(true);
    }
    
    protected SimpleChannelInboundHandler(boolean autoRelease) {
        matcher = TypeParameterMatcher.find(this, SimpleChannelInboundHandler.class, "I");
        this.autoRelease = autoRelease;
    }    
    
    public boolean acceptInboundMessage(Object msg) throws Exception {
        return matcher.match(msg);
    }    

    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
    
        boolean release = true;
        try {
            if (acceptInboundMessage(msg)) {
                @SuppressWarnings("unchecked")
                I imsg = (I) msg;
                channelRead0(ctx, imsg);
            } else {
                release = false;
                ctx.fireChannelRead(msg);
            }
        } finally {
            if (autoRelease && release) {
                ReferenceCountUtil.release(msg);
            }
        }
    }

    protected abstract void channelRead0(ChannelHandlerContext ctx, I msg) throws Exception;
}
```

Netty内置了一系列的channelHandler用于减少使用者的开发工作. 其中`SimpleChannelInboundHandler`提供了资源自动释放的功能. 

当channel发生了读事件后, channel之上绑定的一系列channelHandler的`channelRead`方法将会被调用, 这一过程也是通过模版方法模式实现的, 当入站消息流动到`SimpleChannelInboundHandler`的`channelRead`时. 它会先判断本次传递
的入站消息是否与泛型中定义类型一致, 当判断一致后向下强转类型为泛型类型, 而后交由模版方法`channelRead0`去执行开发者自定义逻辑. 而后在finally代码块中去释放资源的引用计数.




