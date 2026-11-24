#
# 合成题库：tools/c1_*.py（题目与答案） + tools/c2_*.py（解析） -> www/assets/questions.js
#
# 用法：python tools/build.py
#
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import c1_single, c1_multi, c1_judge, c1_blank, c1_short  # noqa: E402
import c2_ex_single, c2_ex_multi, c2_ex_judge, c2_ex_blank  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LETTERS = "ABCDEFGH"

# 知识点标签（顺序即优先级：先匹配先得）
TAGS = {
    "1": "网络基础与OSI",
    "2": "TCP/IP协议族",
    "3": "VRP与设备管理",
    "4": "以太网与交换基础",
    "5": "VLAN与端口",
    "6": "STP生成树",
    "7": "链路聚合",
    "8": "IP地址与子网",
    "9": "ARP",
    "10": "IPv6",
    "11": "静态路由与路由表",
    "12": "RIP",
    "13": "OSPF",
    "14": "PPP/HDLC",
    "15": "NAT",
    "16": "ACL",
    "17": "DHCP",
    "18": "WLAN与AP/AC",
    "19": "组网与综合",
}

RULES = [
    ("10", r"IPv6|RIPng"),
    ("14", r"HDLC|PAP|CHAP|PPPoE"),
    ("12", r"RIP"),
    ("13", r"OSPF|DR/BDR|BDR|LSU|Hello|ABR|ASBR|Router ?ID"),
    ("7", r"链路聚合|Eth-Trunk|LACP|SmartLink|堆叠"),
    ("6", r"STP|RSTP|MSTP|BPDU|根桥|生成树|阻塞|转发延时|桥优先级|端口优先级|BID|端口角色"),
    ("16", r"ACL"),
    ("15", r"NAT|NAPT|PAT|Easy IP"),
    ("17", r"DHCP"),
    ("18", r"WLAN|WIFI|FIT ?AP|瘦 ?AP|胖 ?AP|FAT ?AP|CAPWAP|SSID|无线|射频|扫描"),
    ("9", r"ARP"),
    ("5", r"VLAN|Trunk|Hybrid|Access|802\.1Q|PVID|GVRP|隔离端口|隔离组"),
    ("4", r"交换机|MAC 地址表|MAC地[址]*表|未知单播|泛洪|以太帧|以太网帧|冲突域|广播域|集线器|网桥|三层交换机|二层交换机"),
    ("8", r"\d+\.\d+\.\d+\.\d+|子网|掩码|广播地址|主机位|主机地址|VLSM|/26|/30|地址方案"),
    ("11", r"路由表|静态路由|默认路由|缺省路由|浮动|等价路由|路由优先级|管理距离|最长匹配|下一跳|直连路由|动态路由|路由信息|路由来源|浮动静态"),
    ("3", r"VRP|视图|display|system-view|Console|VTY|Telnet|SSH|权限|用户级别|rmdir|mkdir|save|reboot|reset|文件|startup"),
    ("2", r"TCP|UDP|HTTP|FTP|DNS|ICMP|协议分层|三次握手|应用层|传输层|网际层|网络接入层|OSI|TCP/IP"),
    ("1", r"网络通信|局域网|城域网|广域网|拓扑|封装|解封装|网络类型|互联网"),
]


def pick_tag(text):
    for tid, pat in RULES:
        if re.search(pat, text, re.I):
            return tid
    return "19"


def norm_stem(stem):
    """把题干中的空位统一写成 ____"""
    s = re.sub(r"_{2,}", "____", stem)
    s = re.sub(r"（\s*）", "____", s)
    s = re.sub(r"\(\s*\)", "____", s)
    return s


def build():
    out = []
    counts = {"single": 0, "multi": 0, "judge": 0, "blank": 0, "short": 0}

    assert len(c1_single.SINGLE) == len(c2_ex_single.EX_SINGLE), "单选题与解析数量不一致"
    for i, (q, opts, ans) in enumerate(c1_single.SINGLE, start=1):
        q = norm_stem(q.strip())
        out.append({
            "id": "s%03d" % i, "type": "single", "no": i, "q": q,
            "o": [{"k": LETTERS[j], "t": t.strip()} for j, t in enumerate(opts)],
            "a": [ans], "e": c2_ex_single.EX_SINGLE[i],
            "tag": pick_tag(q + " ".join(opts)),
        })
        counts["single"] += 1

    assert len(c1_multi.MULTI) == len(c2_ex_multi.EX_MULTI), "多选题与解析数量不一致"
    for i, (q, opts, ans) in enumerate(c1_multi.MULTI, start=1):
        q = norm_stem(q.strip())
        a = sorted(set(ans))
        if len(a) == 1:
            q = "【单选】" + q
        out.append({
            "id": "m%03d" % i, "type": "multi", "no": i, "q": q,
            "o": [{"k": LETTERS[j], "t": t.strip()} for j, t in enumerate(opts)],
            "a": a, "e": c2_ex_multi.EX_MULTI[i],
            "tag": pick_tag(q + " ".join(opts)),
        })
        counts["multi"] += 1

    assert len(c1_judge.JUDGE) == len(c2_ex_judge.EX_JUDGE), "判断题与解析数量不一致"
    for i, (q, ans, img) in enumerate(c1_judge.JUDGE, start=1):
        item = {
            "id": "j%03d" % i, "type": "judge", "no": i, "q": q.strip(),
            "a": ["T" if ans else "F"], "e": c2_ex_judge.EX_JUDGE[i], "tag": pick_tag(q),
        }
        if img:
            item["img"] = img
        out.append(item)
        counts["judge"] += 1

    assert len(c1_blank.BLANKS) == len(c2_ex_blank.EX_BLANK), "填空题与解析数量不一致"
    for i, (q, answers, _) in enumerate(c1_blank.BLANKS, start=1):
        stem = norm_stem(q.strip())
        out.append({
            "id": "b%03d" % i, "type": "blank", "no": i, "q": stem,
            "n": max(stem.count("____"), 1), "a": answers,
            "e": c2_ex_blank.EX_BLANK[i], "tag": pick_tag(q),
        })
        counts["blank"] += 1

    for i, (q, a) in enumerate(c1_short.SHORT, start=1):
        out.append({
            "id": "t%03d" % i, "type": "short", "no": i, "q": q.strip(), "a": a.strip(),
            "e": "【自测提示】先口述/写出要点，再与参考答案逐条对照；注意分点作答（定义、原理、优缺点、适用场景）。",
            "tag": pick_tag(q),
        })
        counts["short"] += 1

    return out, counts


def main():
    items, counts = build()
    meta = {
        "title": "网络互联技术基础 · 刷题助手",
        "source": "2026-2027-1《网络互联技术基础题库》",
        "counts": counts,
        "total": len(items),
    }
    target = os.path.join(ROOT, "www", "assets", "questions.js")
    with open(target, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* 自动生成，请勿手工修改。源：tools/c1_*.py（题目/答案） + tools/c2_*.py（解析），生成脚本 tools/build.py */\n")
        f.write("window.QUESTION_META = %s;\n" % json.dumps(meta, ensure_ascii=False))
        f.write("window.QUESTION_BANK = %s;\n" % json.dumps(items, ensure_ascii=False, separators=(",", ":")))

    # 同步知识点标签文件
    with open(os.path.join(ROOT, "www", "assets", "tags.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("/* 自动生成，请勿手工修改（源：tools/build.py 的 TAGS） */\n")
        f.write("window.TAG_MAP = %s;\n" % json.dumps(TAGS, ensure_ascii=False, indent=2))

    print("✅ 已生成 www/assets/questions.js")
    print("   ", counts, "合计", len(items), "题")


if __name__ == "__main__":
    main()