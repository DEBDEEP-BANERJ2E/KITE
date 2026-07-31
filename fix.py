import re
with open("frontend/src/App.tsx", "r") as f:
    text = f.read()

text = re.sub(r"fetch\(`\$\{API_URL\}([^'`]*?)[']\)", r"fetch(`${API_URL}\1`)", text)
text = re.sub(r"fetch\(`\$\{API_URL\}([^'`]*?)['],", r"fetch(`${API_URL}\1`,", text)

with open("frontend/src/App.tsx", "w") as f:
    f.write(text)
