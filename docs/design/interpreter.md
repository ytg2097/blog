---
prev: ./memo
next: ./state
---

# 解释器模式

解释器模式在我们的开发中并不常见,  它用于用一些固定的语法构建一个解释句子的解释器. 我们常用的正则表达式, 数据库的sql解释器就采用了这种模式.  

## 示例

需求: 继续[观察者模式](./observer.md)中的例子, 完成规则完成规则引擎中的数据匹配部分

需求分析: 我们通常获取到的设备上报的数据都是键值对格式: key=value. 而一次上报数据中可能会包含多组键值对. 规则引擎中的数据匹配其实与SQL解析相似, 循环键值对中各项匹配, 则直接返回true, 执行下一步触发动作. 

### 关系运算符类

```java 
public enum Operator {

    EQUAL(" = "),
    GREATER(" > "),
    LESS(" < "),
    GREATER_EQUAL(" >= "),
    LESS_EQUAl(" <= "),
    NOT_EQUAL(" <> ");

    public final String operator;

    Operator(String operator) {
        this.operator = operator;
    }
}
```

### 连词

```java 
public enum Conjunction {

    AND(" AND "),
    OR(" OR ");

    public final String operator;

    Conjunction(String operator) {
        this.operator = operator;
    }
}
```

### 表达式

表达式类Expression用于表述要匹配的Key与指定的value之间的关系, 及与其他表达式之间的关系

```java 
    @Getter
    @Setter
    class Expression {

        // 关系运算符左侧的Key,
        private String filed;
        // 关系运算符
        private Operator operator;
        // 关系运算符右侧的value
        private String value;

        // 关系运算符可能空, 当为空是, 连词应该不为空
        // 若存在关系运算符, 则这个Expression仅仅描述的是这个表达式中filed与value之间的关系, 而不是与其他键值对之间的关系
        public Expression(String filed, Operator operator, String value) {
            this.filed = filed;
            this.operator = operator;
            this.value = value;
        }

        // 其他表达式 
        private List<Expression> expressions;

        // 与其他表达式之间的关系  OR 或 AND 
        private Conjunction conjunction;

        // 连词可能为空, 当为空是, 关系运算符应该不为空
        // 若存在连词, 则这个Expression描述的是一组表达式之间的关系, 而不是filed与value之间的关系
        public Expression(List<Expression> expressions, Conjunction conjunction) {
            this.expressions = expressions;
            this.conjunction = conjunction;
        }

        @Override
        public String toString() {

            if (Objects.nonNull(conjunction)) {
                return " ( " + expressions.stream().map(Expression::toString).collect(Collectors.joining(conjunction.operator)) + " ) ";
            }
            return filed + operator.operator + value;
        }

        public boolean interpret(Map<String, String> matter) {

            // 若存在连词, 则需要依据连词的语义去依次匹配每个表达式
            if (Objects.nonNull(conjunction)) {

                if (conjunction.equals(Conjunction.AND)) {
                    for (Expression expression : expressions) {
                        if (!expression.interpret(matter)){
                            return false;
                        }
                    }
                } else {
                    for (Expression expression : expressions) {
                        if (expression.interpret(matter)){
                            return true;
                        }
                    }
                }
                return true;
            }
            
            // 不存在连词, 只判断传入的键值对参数之间的关系是否与操作符描述一致即可
            return comparing(matter.get(filed));
        }

        private boolean comparing(String val) {

            switch (operator) {
                case EQUAL:
                    return value.equals(val);
                case GREATER:
                    return Double.parseDouble(val) > Double.parseDouble(value);
                case LESS_EQUAl:
                    return Double.parseDouble(val) <= Double.parseDouble(value);
                case LESS:
                    return Double.parseDouble(val) < Double.parseDouble(value);
                case GREATER_EQUAL:
                    return Double.parseDouble(val) >= Double.parseDouble(value);
                case NOT_EQUAL:
                    return Double.parseDouble(val) != Double.parseDouble(value);
                default:
                    return false;
            }
        }
    }
```

### 测试

```java 

    @Test
    public void test() {

        Expression door = new Expression("门磁", Operator.EQUAL, "开");
        Expression flooding = new Expression("水浸", Operator.EQUAL, "开");
        Expression vol = new Expression("电压", Operator.LESS, "3");

        Expression paramValue = new Expression(newArrayList(door, flooding, vol), Conjunction.OR);

        Expression city = new Expression("城市", Operator.EQUAL, "济南");
        Expression rule = new Expression(newArrayList(city, paramValue), Conjunction.AND);

        System.out.println(rule);

        Map<String, String> matter = newHashMap();
        matter.put("门磁", "开");
        matter.put("水浸", "否");
        matter.put("vol", "3.4");
        matter.put("城市", "济南");

        boolean exec = rule.interpret(matter);
        System.out.println(exec);   // true
        
        matter.put("城市", "潍坊");
        exec = rule.interpret(matter);
        System.out.println(exec);   // false
    }
```

 


