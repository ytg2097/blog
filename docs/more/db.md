---
prev: ./clean-code
next: ./JS
sidebar: auto
---

# 数据库优化

本文记录我目前所知道的一点数据库(单指mysql)优化点. 现阶段的学习比较偏概念和理论. 对数据库和消息队列这类基础设施的学习并不深. 
后续慢慢补充吧. 

## 设计

### 字段设计

- 数据设计依据三范式. 主键不可再拆分, 非主键字段要依赖主键, 不能存在间接依赖
- 字段尽量使用整形而不是字符串
- 货币字段尽量使用小单位大数额, 避免出现小数
- 尽可能选择小的数据类型和短的数据长度

### 索引

- order by字段要添加索引. 如果没有索引会全量取出数据排序
- 索引覆盖. 如果select后的字段都建立了索引, 那么查询会直接在索引表中查询而不是原始数据
- 符合索引. 符合索引全部命中时比单独建立索引的更高效. 单独索引会分别在索引表中二分查找出匹配记录, 再取交集
- 枚举不容易使用到索引. 一个枚举值可能匹配大量记录, 这种情况mysql会认为利用索引比全表扫描效率低. 

### 分区

只有检索字段为分区字段时效果才会明显. 

分区算法:
- hash. 仅适用于整形字段
- key. 从字符串中计算出一个整形进行取模运算
- range. partition by range (字段名) (分区名 values less than (指定值))  .只支持less than
- list partition by list (字段名) (分区名 value in (1,20))

### 分表

- 水平分隔. 多张相同表结构. 大部分都是水平分隔
- 垂直分隔. 字段分别存储在不同表中


## 查询

- 最左匹配原则. 必须按照符合索引的顺序写sql
- 防止隐式转换. 比如有phone字段为字符串类型, 那么查询是不要出现phone = 111. 会导致mysql使用隐世替换, 导致索引失效.
- 不要使用select * . 
- like %name. 不要把%写在前面, 无法命中索引
- 不要在where左侧对索引字段使用运算符, 会导致索引失效
- 以用limit 1 提高效率
- or要求两边都有索引可用, 如果一遍有索引, 一遍无索引会导致SQL全表扫描
- limit的分页过大. 比如limit 200000, 10.
> 可以使用子查询替代`select id,name from table where id>=(select id from table order by id limit 200000,1) limit 10;`
>
> 也可以使用延迟关联处理. `select table.id, table.name from table t inner join (select id from table order by id limit 200000,5) as table_1 using(id);`
- count. count(*)效率与count(1)差不多, count(id)低一点, count(其他字段)最低
