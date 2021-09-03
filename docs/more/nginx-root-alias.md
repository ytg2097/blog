---
sidebar: none
---

# Nginx的静态资源404问题解决

>  **先看日志先看日志!**

### 需求

部署一套网站, 网站的html与css, js 和图片这些静态资源分别在不同目录中.

结构如下:

```
├─htmlas
│  └─web         # html文件位置
│  	 ├─product	 # html文件夹
|    ├─news 	 # html文件夹
|    └─index.html
├─upload		# 上传文件所在位置
├─static		
│  ├─css		
│  ├─image		
   └─js         
```

### nginx配置

在我的本地测试的配置如下

```
    server {
        listen       80;
        server_name  localhost;
		
		location /html/web/ {
            root   E:/webapp/html/web/;
        }
		location  /static/ {
			root E:/webapp/static/;
		}
			
		location  /upload/ {
			root E:/webapp/upload/;
		}

		location  /template/ {
			root E:/webapp/template/;
		}

		location  /test/ {
			root E:/webapp/upload/;
		}
         location / {
            root   E:/webapp/html/web/;
            index index.html;
        }
    }
```

### 问题描述

当我访问某个静态文件时, 比如http://localhost/upload/te.pnp.   nginx返回404,  其他静态文件同样的404除了index.html

### 解决

先看日志error.log

```
2021/07/29 10:44:52 [notice] 16676#17292: signal process started
2021/07/29 10:45:05 [error] 16660#9948: *1 CreateFile() "E:/webapp/html/web/update/te.png" failed (3: The system cannot find the path specified), client: 127.0.0.1, server: localhost, request: "GET /update/te.png HTTP/1.1", host: "localhost:801"
2021/07/29 10:45:06 [error] 16660#9948: *1 CreateFile() "E:/webapp/html/web/favicon.ico" failed (2: The system cannot find the file specified), client: 127.0.0.1, server: localhost, request: "GET /favicon.ico HTTP/1.1", host: "localhost:801", referrer: "http://localhost:801/update/te.png"
2021/07/29 10:45:14 [notice] 19112#17880: signal process started
2021/07/29 10:47:35 [error] 17272#2072: *1 CreateFile() "E:/webapp/html/web/update/te.png" failed (3: The system cannot find the path specified), client: 127.0.0.1, server: localhost, request: "GET /update/te.png HTTP/1.1", host: "localhost"
```

日志发现nginx去E:/webapp/html/web/update/下面去寻找te.png了.  它没有把http://localhost/upload/te.pnp中的http://localhost/upload替换为E:/webapp/upload/,   所以必然会404.

查阅资料发现nginx还提供了alias

alias与root的区别:

alais配置的目录nginx会处理为   **alais路径替换localtion路径**

> alais配置的目录后边要加 /

root配置的目录nginx会处理为    **root路径 + location路径**

最后调整配置如下

```
    server {
        listen       80;
        server_name  localhost;
		
		location /html/web/ {
            alias   E:/webapp/html/web/;
        }
		location  /static/ {
			alias E:/webapp/static/;
		}
			
		location  /upload/ {
			alias E:/webapp/upload/;
		}

		location  /template/ {
			alias E:/webapp/template/;
		}

		location  /test/ {
			alias E:/webapp/upload/;
		}
         location / {
            root   E:/webapp/html/web/;
            index index.html;
        }
    }
```

访问成功
