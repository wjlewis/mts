TODO

- Printing
- Less awkward way to handle nullary ops.
- Less awkward way to manage environments + ops.

Maybe unify ops and terms as _values_.

```typescript
type Value = BuiltIn | Op | GroundTerm;

interface GroundTerm {
  functor: string | symbol;
  children: GroundTerm;
}
```
