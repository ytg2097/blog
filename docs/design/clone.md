---
next: ./builder
prev: ./factory
---

# 原型模式

原型模式又叫克隆模式. 他用于避免重复的实例初始化操作.

## Cloneable接口 
原型模式中有一个很重要的接口`Cloneable`
```java 
public interface Cloneable {
}
```
查看源码发现他只是一个标记接口, 并没有定义与克隆相关的方法. 而真正的clone方法是定义在Object中.
```java 
protected native Object clone() throws CloneNotSupportedException;
``` 
Object定义的clone方法会在执行时检查重写clone方法的类是否有实现Cloneable接口, 如果没有实现将会抛出一个CloneNotSupportedException.

Object的clone方法返回的对象是浅拷贝对象. 

::: tip 浅拷贝
浅拷贝只复制对象的基本类型字段的值与引用对象的引用地址. 
所以需要注意在使用浅拷贝时, 如果有属性是引用类型时, 如果被拷贝对象或拷贝对象修改了这个引用类型属性中的某些状态的话, 将会影响其他所有使用这个属性的对象
:::

::: tip 深拷贝
深拷贝与浅拷贝的区别是, 深拷贝在拷贝对象会检查对象的属性是否有非不可变得引用类型属性, 如果有则会将这个引用类型属性中的所有属性也都拷贝一遍. 
:::

## 示例

### 浅拷贝
```java 
public class CloneTest {

    @Test
    public void test_clone(){

        Ref ref = new Ref(2);
        ConcreteCloneable instance1 = new ConcreteCloneable(1,ref);
        try {
            ConcreteCloneable instance2 = (ConcreteCloneable) instance1.clone();
            System.out.println(instance1.ref == instance2.ref);
        } catch (CloneNotSupportedException e) {
            e.printStackTrace();
        }
    }

    public class Ref{

        public int b;

        public Ref(int b) {
            this.b = b;
        }

    }

    public class ConcreteCloneable implements Cloneable{

        public int a;
        public Ref ref;

        @Override
        protected Object clone() throws CloneNotSupportedException {
            return super.clone();
        }

        public ConcreteCloneable(int a, Ref ref) {
            this.a = a;
            this.ref = ref;
        }
    }
}
```

### 深拷贝

```java 
public class CloneTest {

    @Test
    public void test_clone(){

        Ref ref = new Ref(2);
        ConcreteCloneable instance1 = new ConcreteCloneable(1,ref);
        try {
            ConcreteCloneable instance2 = (ConcreteCloneable) instance1.clone();
            System.out.println(instance1.ref == instance2.ref);
        } catch (CloneNotSupportedException e) {
            e.printStackTrace();
        }
    }

    public class Ref{

        public int b;

        public Ref(int b) {
            this.b = b;
        }

    }

    public class ConcreteCloneable implements Cloneable{

        public int a;
        public Ref ref;

        @Override
        protected Object clone() throws CloneNotSupportedException {
            ConcreteCloneable clone = (ConcreteCloneable) super.clone();
            clone.ref = new Ref(ref.b);
            return clone;
        }

        public ConcreteCloneable(int a, Ref ref) {
            this.a = a;
            this.ref = ref;
        }
    }
}
```

除使用Cloneable接口进行手动赋值之外, 还可以使用序列化与反序列化的方式实现对象克隆, 还有许多第三方类库提供了对象拷贝功能. 如`BeanUtil.copyProperties`
