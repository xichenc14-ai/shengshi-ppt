content = open('/Users/macmini/shengshi-ppt/src/app/api/user/route.ts').read()
lines = content.split('\n')
in_str = False
str_char = None
paren_depth = 0
bracket_depth = 0
brace_depth = 0

for i, line in enumerate(lines, 1):
    j = 0
    while j < len(line):
        c = line[j]
        if not in_str:
            if c in ('"', "'", '`'):
                in_str = True
                str_char = c
                print(f"Line {i}: entering string with char {repr(c)} at pos {j}")
            elif c == '/' and j+1 < len(line) and line[j+1] == '/':
                break
            elif c == '(':
                paren_depth += 1
            elif c == ')':
                paren_depth -= 1
            elif c == '[':
                bracket_depth += 1
            elif c == ']':
                bracket_depth -= 1
            elif c == '{':
                brace_depth += 1
                print(f"Line {i}: brace +1 -> {brace_depth} at pos {j}: {line[:40]}")
            elif c == '}':
                brace_depth -= 1
                print(f"Line {i}: brace -1 -> {brace_depth} at pos {j}: {line[:40]}")
        else:
            if c == str_char and (j == 0 or line[j-1] != '\\'):
                print(f"Line {i}: exiting string with char {repr(c)} at pos {j}")
                in_str = False
                str_char = None
        j += 1
    if i >= 468 and i <= 485:
        print(f'{i}: in_str={in_str} paren={paren_depth} bracket={bracket_depth} brace={brace_depth}  {line[:70]}')
print(f'Final: paren={paren_depth} bracket={bracket_depth} brace={brace_depth}')