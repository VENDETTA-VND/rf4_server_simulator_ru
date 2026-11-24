package gameserver

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

const gearAssistantUID int64 = 2147483646
const gearAssistantName = "Помощник по снастям"

func overloadProtectionKey(uid int64) string {
	return fmt.Sprintf("gear-assistant:overload-protection:%d", uid)
}

type overloadProtectionReader interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func readOverloadProtection(ctx context.Context, db overloadProtectionReader, uid int64) (bool, error) {
	return readKVFlag(ctx, db, overloadProtectionKey(uid))
}

// 钓具助手采用两级菜单交互：
//
//	一级：1 【满红不爆】 / 2 【耐力播报】
//	二级（发功能序号后进入）：只响应 开(y) 关(n) 说明(h) 返回(b)；
//	                        未知输入重复二级菜单；b 退回一级。
type gearFeature struct {
	label  string // 回复里显示的名称
	onNew  string // 新开启时的回复
	offNew string // 新关闭时的回复
	desc   string // 「说明」子命令返回的功能描述
}

// gearSep 是菜单行之间的分隔线。长度按客户端聊天气泡宽度实测调过：22 个会折行，21 个刚好一行。
const gearSep = "─────────────────────"

var gearFeatures = map[string]gearFeature{
	"overload": {"【Защита снастей】", "Включена для всех ваших удилищ.", "Выключена. Восстановлены обычные правила износа и поломки снастей.", "【Защита снастей】: предотвращает поломку компонентов оснастки и сгорание катушки от перегрузки. Обычный износ, сход рыбы и обрыв лески вручную не затрагиваются; существующие повреждения не ремонтируются."},
	"stamina":  {"【Отчёт о выносливости】", "Включено: во время вываживания каждые 5 секунд в чате показываются выносливость рыбы и перегрузка снасти.", "Выключено.", "【Отчёт о выносливости】: во время вываживания каждые 5 секунд в чате показываются оставшаяся выносливость рыбы и перегрузка. Выносливость постепенно падает до 0. Перегрузка — процент, на который сила рывка рыбы превышает максимальную нагрузку всей оснастки: 0% означает, что снасть справляется. Чем выше значение, тем сложнее вываживание; по мере усталости рыбы перегрузка снижается. Сообщения появляются только при вываживании на удилище в руках."},
}

// gearCommand 是一级解析结果：mode 为 help/unknown/cmd。
type gearCommand struct {
	mode    string // "help" | "unknown" | "cmd"
	feature string // "overload" | "stamina"
	action  string // ""=进入二级看状态 | "on" | "off" | "desc" | "back"
}

func parseGearCommand(text string) gearCommand {
	fields := strings.Fields(strings.TrimSpace(text))
	if len(fields) == 0 {
		return gearCommand{mode: "help"}
	}
	head := fields[0]
	switch head {
	case "помощь", "меню", "описание", "help", "Help", "HELP", "?", "h", "0", "说明", "帮助", "菜单":
		return gearCommand{mode: "help"}
	case "1", "защита", "перегрузка", "без поломок", "overload", "Overload", "OVERLOAD", "过载", "满红", "满红不爆":
		head = "overload"
	case "2", "выносливость", "stamina", "Stamina", "STAMINA", "耐力":
		head = "stamina"
	case "вкл", "включить", "выкл", "выключить", "статус", "开", "开启", "关", "关闭", "状态":
		// 两级菜单之前的单字指令，语义是满红不爆。保留成一级快捷别名：
		// 老玩家不必先记序号，也不会因为菜单化而失去「开关」这个动作。
		if len(fields) > 1 {
			return gearCommand{mode: "unknown"}
		}
		return gearCommand{mode: "cmd", feature: "overload", action: legacyGearAction(head)}
	default:
		return gearCommand{mode: "unknown"}
	}
	action := ""
	if len(fields) > 1 {
		switch fields[1] {
		case "вкл", "включить", "on", "enable", "ON", "ENABLE", "k", "K", "y", "Y", "开", "开启":
			action = "on"
		case "выкл", "выключить", "off", "disable", "OFF", "DISABLE", "g", "G", "n", "N", "关", "关闭":
			action = "off"
		case "статус", "status", "query", "STATUS", "状态":
			action = ""
		case "описание", "help", "describe", "info", "?", "HELP", "DESCRIBE", "INFO", "h", "H", "说明":
			action = "desc"
		case "назад", "back", "BACK", "b", "B", "返回":
			action = "back"
		default:
			return gearCommand{mode: "unknown"}
		}
	}
	return gearCommand{mode: "cmd", feature: head, action: action}
}

// legacyGearAction 把旧单字指令还原成二级动作；「状态」对应空动作（只显示菜单）。
func legacyGearAction(text string) string {
	switch text {
	case "вкл", "включить", "开", "开启":
		return "on"
	case "выкл", "выключить", "关", "关闭":
		return "off"
	}
	return ""
}

// gearReply 拼出二级菜单内任意操作的回复，统一带快捷键尾行。
func gearReply(f gearFeature, action string, enabled bool) (next bool, reply string) {
	const footer = "\n" + gearSep + "\nВкл (y) · Выкл (n) · Описание (h) · Назад (b)"
	next = enabled
	switch action {
	case "on":
		next = true
		if enabled {
			reply = f.label + " уже включено."
		} else {
			reply = f.label + f.onNew
		}
	case "off":
		next = false
		if !enabled {
			reply = f.label + " уже выключено."
		} else {
			reply = f.label + f.offNew
		}
	case "desc":
		reply = f.desc
	default:
		status := "Выключено"
		if enabled {
			status = "Включено"
		}
		reply = "【Текущий статус】: " + status
	}
	reply += footer
	return next, reply
}

func gearAssistantHelp() string {
	items := []string{"1  【Защита снастей】", "2  【Отчёт о выносливости】"}
	// 每行下面都跟一条分隔线（含最后一行），形成下划线效果。
	return strings.Join(items, "\n"+gearSep+"\n") + "\n" + gearSep
}

// ---- 二级菜单状态（per uid）----

func (s *Server) gearMenuGet(uid int64) string {
	s.gearMenuMu.Lock()
	defer s.gearMenuMu.Unlock()
	if s.gearMenuState == nil {
		return ""
	}
	return s.gearMenuState[uid]
}

func (s *Server) gearMenuSet(uid int64, feature string) {
	s.gearMenuMu.Lock()
	defer s.gearMenuMu.Unlock()
	if s.gearMenuState == nil {
		s.gearMenuState = make(map[int64]string)
	}
	s.gearMenuState[uid] = feature
}

func (s *Server) gearMenuClear(uid int64) {
	s.gearMenuMu.Lock()
	defer s.gearMenuMu.Unlock()
	if s.gearMenuState != nil {
		delete(s.gearMenuState, uid)
	}
}

// gearAssistantReplyText 只回一条消息、不改任何设置，用于帮助、未知与二级菜单显示。
func (s *Server) gearAssistantReplyText(ctx *Ctx, uid int64, reply string) ([]byte, bool) {
	c := ctx.Sess.pushCtx()
	tx, err := beginEconomyTx(c, s.DB)
	if err != nil {
		ctx.ReplyFailure("System.IO.IOException", "Не удалось сохранить настройки снастей")
		return nil, true
	}
	defer func() { _ = tx.Rollback() }()
	var mailID int64
	mailID, err = insertContactReply(c, tx, uid, gearAssistantUID, reply)
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		ctx.ReplyFailure("System.IO.IOException", "Не удалось сохранить настройки снастей")
		return nil, true
	}
	ctx.AfterResponse(func() { s.notifyMail(ctx.Sess.pushCtx(), uid, mailID) })
	return []byte{0}, true
}

// receiveGearAssistant 路由两级菜单：先判断是否在二级，否则处理一级。
func (s *Server) receiveGearAssistant(ctx *Ctx, text string) ([]byte, bool) {
	if !ctx.ExpectResponse {
		return nil, true
	}
	uid := ctx.Sess.Userid
	if uid <= 0 {
		ctx.ReplyFailure("System.InvalidOperationException", "Сначала войдите в игру")
		return nil, true
	}

	// 二级菜单：只响应 y/n/h/b，未知重显，b 返回一级。
	if state := s.gearMenuGet(uid); state != "" {
		return s.gearSubMenu(ctx, uid, state, text)
	}

	// 一级
	cmd := parseGearCommand(text)
	switch cmd.mode {
	case "help":
		return s.gearAssistantReplyText(ctx, uid, gearAssistantHelp())
	case "unknown":
		return s.gearAssistantReplyText(ctx, uid, gearAssistantHelp())
	}
	// cmd.mode == "cmd"：进入对应二级
	s.gearMenuSet(uid, cmd.feature)
	if cmd.action == "back" {
		s.gearMenuClear(uid)
		return s.gearAssistantReplyText(ctx, uid, gearAssistantHelp())
	}
	if cmd.action == "" {
		return s.gearSubShow(ctx, uid, cmd.feature)
	}
	return s.gearSubAction(ctx, uid, cmd.feature, cmd.action)
}

// gearSubMenu 处理二级内的输入：只认 y/n/h/b，未知重显，b 返回一级。
func (s *Server) gearSubMenu(ctx *Ctx, uid int64, feature, text string) ([]byte, bool) {
	switch strings.ToLower(strings.TrimSpace(text)) {
	case "y", "k", "开", "开启", "on", "enable":
		return s.gearSubAction(ctx, uid, feature, "on")
	case "n", "g", "关", "关闭", "off", "disable":
		return s.gearSubAction(ctx, uid, feature, "off")
	case "h", "описание", "说明", "help", "describe", "info", "?":
		return s.gearSubShow(ctx, uid, feature, "desc")
	case "b", "назад", "返回", "back":
		s.gearMenuClear(uid)
		return s.gearAssistantReplyText(ctx, uid, gearAssistantHelp())
	default:
		// 输入未知，重复二级命令
		return s.gearSubShow(ctx, uid, feature)
	}
}

// gearReadFlag 在独立短事务中读取开关，事务在返回前结束，避免与后续回信事务重叠。
func (s *Server) gearReadFlag(c context.Context, uid int64, feature string) (bool, error) {
	key := overloadProtectionKey(uid)
	if feature == "stamina" {
		key = staminaReportKey(uid)
	}
	tx, err := beginEconomyTx(c, s.DB)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()
	return readKVFlag(c, tx, key)
}

// gearSubShow 显示二级菜单（可选先显示说明），不改设置。
func (s *Server) gearSubShow(ctx *Ctx, uid int64, feature string, prefix ...string) ([]byte, bool) {
	enabled, err := s.gearReadFlag(ctx.Sess.pushCtx(), uid, feature)
	if err != nil {
		ctx.ReplyFailure("System.IO.IOException", "Не удалось прочитать настройки снастей")
		return nil, true
	}
	var reply string
	if len(prefix) > 0 && prefix[0] == "desc" {
		reply = gearFeatures[feature].desc + "\n\n"
	}
	_, body := gearReply(gearFeatures[feature], "", enabled)
	reply += body
	return s.gearAssistantReplyText(ctx, uid, reply)
}

// gearSubAction 在二级内执行开/关，写设置后停留二级（重显二级菜单）。
func (s *Server) gearSubAction(ctx *Ctx, uid int64, feature, action string) ([]byte, bool) {
	// 只有满红不爆要和断件/负载判定串行（同一把锁也在磨损结算里用）。
	// 耐力播报只读写自己那一行 kv，没必要占用它，避免菜单的 DB+邮件写入阻塞搏鱼结算。
	if feature == "overload" {
		s.overloadProtectionMu.Lock()
		defer s.overloadProtectionMu.Unlock()
	}
	c := ctx.Sess.pushCtx()
	tx, err := beginEconomyTx(c, s.DB)
	if err != nil {
		ctx.ReplyFailure("System.IO.IOException", "Не удалось сохранить настройки снастей")
		return nil, true
	}
	defer func() { _ = tx.Rollback() }()
	key := overloadProtectionKey(uid)
	if feature == "stamina" {
		key = staminaReportKey(uid)
	}
	enabled, err := readKVFlag(c, tx, key)
	if err != nil {
		ctx.ReplyFailure("System.IO.IOException", "Не удалось прочитать настройки снастей; настройки не изменены")
		return nil, true
	}
	next, reply := gearReply(gearFeatures[feature], action, enabled)
	var mailID int64
	if next != enabled {
		value := "0"
		if next {
			value = "1"
		}
		_, err = tx.ExecContext(c, `INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, key, value)
	}
	if err == nil {
		mailID, err = insertContactReply(c, tx, uid, gearAssistantUID, reply)
	}
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		ctx.ReplyFailure("System.IO.IOException", "Не удалось сохранить настройки снастей; настройки не изменены")
		return nil, true
	}
	if next != enabled {
		switch feature {
		case "overload":
			now := time.Now()
			for _, st := range s.fishingStatesFor(uid) {
				st.mu.Lock()
				// Keep incurred wear; the timestamp only bounds later tick billing.
				st.reelWear.lastLoadAt = now
				st.reelWear.protectionChangedAt = now
				st.mu.Unlock()
			}
		case "stamina":
			// 设置已落库，清掉进程内缓存，下一条 14/8 重新读。
			s.invalidateStaminaFlag(uid)
		}
	}
	ctx.AfterResponse(func() { s.notifyMail(ctx.Sess.pushCtx(), uid, mailID) })
	return []byte{0}, true
}
