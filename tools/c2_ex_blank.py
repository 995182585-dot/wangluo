# -*- coding: utf-8 -*-
"""填空题解析（stage 2/3）：题号 -> 解析文本"""

EX_BLANK = {
1: "【考点】WLAN 组网协议。FIT AP 与 AC 之间通过 CAPWAP（Control And Provisioning of Wireless Access Points）协议建立隧道，控制隧道 UDP 5246、数据隧道 UDP 5247。\n"
   "【记忆】AP↔AC = CAPWAP。",
2: "【考点】DHCP 端口。DHCP 服务器监听 UDP 67，客户端监听 UDP 68。\n"
   "【易错】DHCPv6 则是客户端 546、服务器 547。",
3: "【考点】NAT 类型。PAT = Port Address Translation，也叫 NAPT（网络地址端口转换）、端口复用，用“私网 IP+端口”映射到“公网 IP+端口”。\n"
   "【记忆】多对一、共用公网 IP = PAT/NAPT。",
4: "【考点】PPPoE 阶段。PPPoE 分发现（Discovery）阶段和会话（Session）阶段：先通过 PADI/PADO/PADR/PADS 确认对端 MAC，再在会话中运行 PPP（LCP 协商、认证、NCP）。\n"
   "【记忆】先发现、后会话。",
5: "【考点】ACL 编号范围。基本 ACL 2000～2999、高级 ACL 3000～3999、二层 ACL 4000～4999、用户 ACL 5000～5999。\n"
   "【记忆】2 基本、3 高级、4 二层、5 用户。",
6: "【考点】以太网帧长度。最小 64 字节（保证 CSMA/CD 冲突检测），最大 1518 字节（含 14 字节帧头 + 4 字节 FCS）。\n"
   "【记忆】64～1518 字节（不含前导码）。",
7: "【考点】ARP 的作用。ARP 将已知的 IP 地址解析为对应的 MAC 地址；MAC→IP 是 RARP。\n"
   "【记忆】ARP：IP→MAC。",
8: "【考点】ARP 报文发送方式。ARP 请求以广播方式发送，ARP 应答以单播方式发送。\n"
   "【记忆】请求广播、应答单播。",
9: "【考点】802.1Q 标签。VID 字段 12 位，可表示 0～4095，其中 1～4094 可用（共 4094 个），0 和 4095 保留。\n"
   "【易错】4094 是“可用 VLAN 个数”，不是 4096。",
10: "【考点】Access 端口打标签规则。收到不带标签的帧时，打上该端口 PVID 对应的 VLAN 标签；发送时剥离。\n"
    "【记忆】Access 入打 PVID、出剥标签。",
11: "【考点】Trunk 与 PVID。Trunk 端口默认 PVID 为 VLAN 1，允许 VLAN 1 通过，且 VLAN 1 的帧以 Untagged 方式发送（剥离标签）。\n"
    "【记忆】默认 PVID = VLAN 1。",
12: "【考点】Hybrid 端口特性。Hybrid 可同时作为接入端口（连主机）和干道端口（连交换机），通过 tagged/untagged 灵活控制。\n"
    "【记忆】Hybrid = 两用的“万金油”端口。",
13: "【考点】VLAN 间路由实现。可通过路由器（单臂/多臂路由）或三层交换机（VLANIF）实现。\n"
    "【记忆】路由器 or 三层交换机。",
14: "【考点】Access 端口划入 VLAN。华为：port default vlan <vlan-id>（旧版本 port access vlan <id>）。\n"
    "【记忆】port default vlan 10。",
15: "【考点】Trunk 允许 VLAN 通过。port trunk allow-pass vlan <vlan-id>（可写多个或 all）。\n"
    "【记忆】先 port link-type trunk，再 port trunk allow-pass vlan。",
16: "【考点】二层环路危害。广播风暴、MAC 地址表震荡（表项不稳定）、多帧复制（同一帧被多次收到），另外还有设备 CPU 过高。\n"
    "【记忆】风暴 + 震荡 + 多帧复制。",
17: "【考点】STP 消除环路的机制。STP 通过选举根桥、根端口、指定端口，并把其余端口置为阻塞状态（阻塞冗余链路），把环形拓扑变成树形。\n"
    "【记忆】阻塞冗余链路 → 逻辑无环。",
18: "【考点】STP 根端口。每个非根交换机有且仅有一个根端口（到根桥开销最小的端口）。\n"
    "【记忆】非根桥：1 个根端口、多个指定端口/阻塞端口。",
19: "【考点】STP 指定端口。每条网段（链路）上有且仅有一个指定端口，负责向该网段转发数据；根桥上所有端口都是指定端口。\n"
    "【记忆】一条链路一个指定端口。",
20: "【考点】RSTP 端口状态。RSTP 把 STP 五种状态合并为三种：Discarding（丢弃/丢弃端口角色）、Learning（学习）、Forwarding（转发）。\n"
    "【记忆】RSTP 三态：丢弃、学习、转发。",
21: "【考点】链路聚合的本质。把多个物理接口捆绑成一个逻辑接口（Eth-Trunk/聚合组），实现带宽叠加与冗余。\n"
    "【记忆】物理口多，逻辑口一。",
22: "【考点】链路聚合模式。手工负载分担模式与 LACP（链路聚合控制协议）模式。\n"
    "【记忆】手工 / LACP。",
23: "【考点】创建 Eth-Trunk。interface Eth-Trunk <trunk-id>，编号范围 0～63（部分设备 0～127）。\n"
    "【记忆】先建聚合接口。",
24: "【考点】成员口加入聚合组。在 Eth-Trunk 视图下使用 trunkport <interface-type> <interface-id>（如 trunkport GigabitEthernet 0/0/1 to 0/0/3）。\n"
    "【记忆】trunkport 加成员。",
25: "【考点】链路聚合的一致性要求。成员接口的速率、双工模式、链路类型/VLAN 配置必须一致。\n"
    "【记忆】速率、双工、VLAN 三一致。",
26: "【考点】查看命令。display vlan 查看 VLAN 信息，display eth-trunk <trunk-id> 查看聚合组状态。\n"
    "【记忆】display vlan / display eth-trunk。",
27: "【考点】默认路由。目的网络 0.0.0.0、掩码 0.0.0.0，用于匹配所有未明确匹配的目的地址。\n"
    "【记忆】0.0.0.0/0 = 缺省路由。",
28: "【考点】静态路由命令。ip route-static <dest> <mask> <nexthop|interface> [preference <val>]。\n"
    "【易错】华为是 ip route-static，不是 Cisco 的 ip route。",
29: "【考点】默认路由命令。ip route-static 0.0.0.0 0.0.0.0 <下一跳>。\n"
    "【记忆】默认路由就是目的/掩码全 0 的静态路由。",
30: "【考点】路由优先级。华为默认：直连 0、静态 60；RIP 100、OSPF(域内)10。\n"
    "【记忆】直连 0、静态 60。",
31: "【考点】RIP 算法与度量。基于距离矢量（DV / Bellman-Ford）算法，以跳数（Hop Count）为度量值。\n"
    "【记忆】RIP = DV + 跳数。",
32: "【考点】RIP 最大跳数。最大有效跳数 15，16 表示不可达（无穷大）。\n"
    "【记忆】RIP ≤15 跳。",
33: "【考点】RIP 计时器与端口。每 30 秒发送一次完整路由更新；使用 UDP 520 端口。\n"
    "【易错】RIPng 用 UDP 521。",
34: "【考点】RIPv1 与 RIPv2。RIPv2 携带子网掩码，支持 VLSM/CIDR；RIPv1 是有类协议，不携带掩码。\n"
    "【记忆】v2 有掩码、v1 无掩码。",
35: "【考点】OSPF 算法与度量。基于链路状态（Dijkstra/SPF）算法，以开销 Cost 为度量值（10^8/带宽，可用 bandwidth-reference 调整）。\n"
    "【记忆】OSPF = LS + Cost。",
36: "【考点】OSPF 骨干区域。Area 0（0.0.0.0）是骨干区域，连接所有其他区域。\n"
    "【记忆】骨干 = Area 0。",
37: "【考点】ABR。区域边界路由器（Area Border Router）连接骨干区域与一个或多个非骨干区域。\n"
    "【记忆】ABR = 跨区域的“边检”。",
38: "【考点】ASBR。自治系统边界路由器（ASBR）负责引入外部路由（静态、RIP、直连等）到 OSPF。\n"
    "【记忆】ASBR = 引入外部路由。",
39: "【考点】Hello 报文。发现邻居、维护邻接关系、选举 DR/BDR 并作为保活机制（默认 10s 发送，40s 死亡）。\n"
    "【记忆】Hello 三大作用：发现、保活、选 DR。",
40: "【考点】DR 的作用。在广播/NBMA 网络中选举出的指定路由器，集中接收并泛洪 LSA，使邻接关系数量由 n(n-1)/2 降为 n-1。\n"
    "【注意】DR 不是 STP 的“根”，原题答案中“生成树的根”属于表述混用，实际是“星型泛洪的中心”。",
41: "【考点】OSPF 邻接与邻居。DRother 与 DR/BDR 形成邻接（Full，同步 LSDB），与其他 DRother 只保持邻居（2-Way）。\n"
    "【记忆】DRother↔DR/BDR：邻接；DRother↔DRother：邻居。",
42: "【考点】VRP 视图。登录后进入用户视图 <Huawei>，输入 system-view 进入系统视图 [Huawei]。\n"
    "【记忆】<> --system-view--> []。",
43: "【考点】查看配置。display current-configuration 查看当前运行配置；display saved-configuration 查看已保存的启动配置。\n"
    "【记忆】current 看内存，saved 看 Flash。",
44: "【考点】文件系统。dir 查看文件列表，mkdir 创建目录。\n"
    "【记忆】dir / mkdir / rmdir / copy / rename / delete。",
45: "【考点】文件复制与重命名。copy 复制文件，rename 重命名文件。\n"
    "【记忆】copy 复制，rename 改名。",
46: "【考点】用户级别。华为 VRP 权限级别 0～15 共 16 级，其中 3～15 级为管理级，15 级拥有最高权限。\n"
    "【记忆】16 级，15 级 = 最高。",
47: "【考点】查看版本与接口。display version 查看版本/型号；display interface brief 查看接口简要状态。\n"
    "【记忆】display version / display interface brief。",
48: "【考点】AP 分类。按是否内置 AC 功能分为胖 AP（FAT AP，可独立工作）和瘦 AP（FIT AP，需要 AC 集中管理）。\n"
    "【记忆】胖 AP 自立，瘦 AP 靠 AC。",
49: "【考点】链路聚合模式。手工模式与 LACP 模式两种。\n"
    "【记忆】手工模式无需协议，LACP 模式可协商与备份。",
50: "【考点】OSPF 网络类型。点到点（P2P）、广播（Broadcast）、非广播多路访问（NBMA）、点到多点（P2MP）。\n"
    "【记忆】P2P、Broadcast、NBMA、P2MP；前两者与 NBMA 的 DR 规则要注意。",
51: "【考点】DHCP Request。客户端通过 DHCP Request 报文向服务器请求特定的 IP 地址（首次请求或续租）。\n"
    "【记忆】Discover 找服务器，Request 要地址。",
52: "【考点】默认路由的适用场合。只有一个出口的内部网络应配置默认路由（缺省路由），把所有未知流量指向唯一出口。\n"
    "【记忆】末梢网络 → 默认路由。",
53: "【考点】根桥选举依据。STP 先比较桥优先级（Bridge Priority，值小者优），优先级相同再比较 MAC 地址（BID 小者胜）。\n"
    "【提示】完整答案应包含“桥优先级 + MAC（桥 ID）”。",
}