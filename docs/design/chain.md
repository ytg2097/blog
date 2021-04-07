---
prev: ./strategy
---

# 责任链模式

责任链模式用于解决一组服务的先后执行处理关系, 责任链中的每个链路节点完成自己的职责, 节点可以任意组合提供给外部调用, 而外部调用不需要关心责任链内部如何处理. 

责任链模式典型的应用是Servlet中的Filter和Spring mvc中的Interceptor.

责任链模式与组合模式的区别是责任链是单向或双向链表结构, 组合模式是树形结构. 

## 示例

需求: 由于HttpServletRequest中的数据要通过流的方式读取, 而HttpServletRequest返回的流只能使用一次, 再次使用时会报错Stream closed. 所以我们需要先重写HttpServletRequestWrapper, 先将流中数据保存, 以供后续使用. 

### 1. 定义RequestWrapper

```java 

public class RepeatedlyRequestWrapper extends HttpServletRequestWrapper {

    private final byte[] body;

    public RepeatedlyRequestWrapper(HttpServletRequest request, ServletResponse response) throws IOException {
        super(request);
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");

        body = HttpHelper.getBodyString(request).getBytes("UTF-8");
    }

    @Override
    public BufferedReader getReader() throws IOException {
        // 重写流获取方法, 返回自定义流
        return new BufferedReader(new InputStreamReader(getInputStream()));
    }

    @Override
    public ServletInputStream getInputStream() throws IOException {

        final ByteArrayInputStream bais = new ByteArrayInputStream(body);

        return new ServletInputStream() {

            @Override
            public int read() throws IOException {
                // 当读取流数据时, 读取我们自己已经保存的数据
                return bais.read();
            }
            ... 
        };
    }
}
```

在写完RepeatedlyRequestWrapper之后, 我们还无法使用, 需要将其配置到servlet的Filter链中才可以. 

### 2. 实现servlet提供的Filter

```java 

// 过滤器中替换原来的ServletRequest
public class RepeatableFilter implements Filter {
     
    ...
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        ServletRequest requestWrapper = null;
        if (request instanceof HttpServletRequest
                && StringUtils.equalsAnyIgnoreCase(request.getContentType(), MediaType.APPLICATION_JSON_VALUE)) {
            requestWrapper = new RepeatedlyRequestWrapper((HttpServletRequest) request, response);
        }
        if (null == requestWrapper) {
            chain.doFilter(request, response);
        } else {
            chain.doFilter(requestWrapper, response);
        }
    }
    ...
}


```

### 3. 添加到Filter链

```java 
    // 配置到Filter链中
    @Bean
    public FilterRegistrationBean someFilterRegistration() {
        FilterRegistrationBean registration = new FilterRegistrationBean();
        registration.setFilter(new RepeatableFilter());
        // 匹配所有请求
        registration.addUrlPatterns("/*");
        registration.setName("repeatableFilter");
        // 添加到链尾
        registration.setOrder(FilterRegistrationBean.LOWEST_PRECEDENCE);
        return registration;
    }
```

## Spring MVC 拦截器的体现

Spring MVC的拦截器用于对我们编写的Controller进行前处理和后处理. 我们通常用它来做一些日志记录, 鉴权认证, 请求限流, 响应格式统一封装等操作. MVC也内置了一些拦截器, 如请求参数封装. 

```java 
public interface HandlerInterceptor {
    default boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        return true;
    }

    default void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, @Nullable ModelAndView modelAndView) throws Exception {
    }

    default void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, @Nullable Exception ex) throws Exception {
    }
}
```

Spring MVC提供的HandlerInterceptor是实现拦截器的基础. 
- preHandle. 用于做控制器方法调用的前处理. 当返回true时, 拦截器链将继续向下执行
- postHandle. 用于做控制器方法调用后, 视图解析前的处理.  
- afterCompletion. 会在视图解析即将完成前调用. 

如果我们要实现一个自定义的拦截器, 可以通过实现HandlerInterceptor接口来实现. 也可以通过继承HandlerInterceptorAdapter来实现. 

Spring MVC框架会帮我们完成拦截器链路的执行. 
