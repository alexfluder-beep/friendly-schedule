// Sends a phone notification when a row is added to "notifications".
// Set up once in the Supabase dashboard: see PUSH-SETUP.md.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const TEXT: Record<string, Record<string, string>> = {
  en: { adjusted: "Pay correction for {title}: {time}", avail_remind: "Please set your working hours for the week of {date} (Tasks).", dispute_new: "{name} asks to check the pay for {title}, {date}", swap_ask: "{name} asks you to take: {title}, {date}", tours_change: "{name} asks to change their tours. Add: {add}. Remove: {drop}.", week_check: "Sunday check: look at your schedule for next week", tour_cancelled: "Tour cancelled: {title}, {date}", tour_restored: "Tour is back on: {title}, {date}", tour_tomorrow: "Tomorrow: {title} at {time}", test: "This phone now gets messages about your tours, time off and tasks.", tour_assigned: "New tour for you: {title}, {date} {time}", tour_removed: "You are no longer on: {title}, {date}", tour_changed: "Tour changed: {title} is now {date} {time}", off_requested: "{name} asks for time off: {from} – {to}", sick_reported: "{name} is off sick: {from} – {to}", off_approved: "Time off approved: {from} – {to}", off_declined: "Time off declined: {from} – {to}", task_assigned: "New task: {title}", task_done: "{name} finished: {title}", event: "Team event: {title}", noshow: "No-show: {name}, {title}", creq_new: "{name} suggests a change: {title}, {date}", creq_approved: "Your change was approved: {title}", creq_declined: "Your change was declined: {title}", statement: "Your pay statement for {title} is ready: {time}" },
  ru: { adjusted: "Корректировка оплаты за {title}: {time}", avail_remind: "Пожалуйста, укажите рабочие часы на неделю с {date} (Задачи).", dispute_new: "{name} просит проверить оплату: {title}, {date}", swap_ask: "{name} просит вас взять тур: {title}, {date}", tours_change: "{name} просит изменить список туров. Добавить: {add}. Убрать: {drop}.", week_check: "Воскресная проверка: посмотрите расписание на следующую неделю", tour_cancelled: "Тур отменён: {title}, {date}", tour_restored: "Тур снова в силе: {title}, {date}", tour_tomorrow: "Завтра: {title} в {time}", test: "Теперь этот телефон получает сообщения о турах, выходных и задачах.", tour_assigned: "Новый тур для вас: {title}, {date} {time}", tour_removed: "Вы больше не на туре: {title}, {date}", tour_changed: "Тур изменён: {title}, теперь {date} {time}", off_requested: "{name} просит выходной: {from} – {to}", sick_reported: "{name} на больничном: {from} – {to}", off_approved: "Выходной утверждён: {from} – {to}", off_declined: "Выходной отклонён: {from} – {to}", task_assigned: "Новая задача: {title}", task_done: "{name} выполнил(а): {title}", event: "Событие команды: {title}", statement: "Ваш расчёт за {title} готов: {time}" },
  ka: { adjusted: "ანაზღაურების კორექტირება {title}: {time}", avail_remind: "გთხოვთ, მიუთითოთ სამუშაო საათები {date}-ის კვირისთვის (დავალებები).", dispute_new: "{name} ითხოვს ანაზღაურების შემოწმებას: {title}, {date}", swap_ask: "{name} გთხოვთ აიღოთ ტური: {title}, {date}", tours_change: "{name} ითხოვს ტურების სიის შეცვლას. დამატება: {add}. მოხსნა: {drop}.", week_check: "კვირის შემოწმება: ნახეთ მომდევნო კვირის განრიგი", tour_cancelled: "ტური გაუქმდა: {title}, {date}", tour_restored: "ტური აღდგა: {title}, {date}", tour_tomorrow: "ხვალ: {title}, {time}", test: "ეს ტელეფონი ახლა იღებს შეტყობინებებს ტურების, დასვენებისა და დავალებების შესახებ.", tour_assigned: "ახალი ტური თქვენთვის: {title}, {date} {time}", tour_removed: "ამ ტურზე აღარ ხართ: {title}, {date}", tour_changed: "ტური შეიცვალა: {title}, ახლა {date} {time}", off_requested: "{name} დასვენებას ითხოვს: {from} – {to}", sick_reported: "{name} ავად არის: {from} – {to}", off_approved: "დასვენება დამტკიცდა: {from} – {to}", off_declined: "დასვენება უარყოფილია: {from} – {to}", task_assigned: "ახალი დავალება: {title}", task_done: "{name}: შესრულდა {title}", event: "გუნდის ღონისძიება: {title}", statement: "თქვენი ანგარიში {title}-ისთვის მზადაა: {time}" },
};

// What each notice is about: a short title and the screen the tap opens.
const GROUP: Record<string, [string, string]> = {
  tour_assigned: ["tour", "#calendar"], tour_changed: ["tour", "#calendar"], tour_removed: ["tour", "#calendar"], tour_cancelled: ["tour", "#calendar"], tour_restored: ["tour", "#calendar"], tour_tomorrow: ["tomorrow", "#calendar"],
  off_requested: ["off", "#timeoff"], sick_reported: ["off", "#timeoff"], off_approved: ["off", "#timeoff"], off_declined: ["off", "#timeoff"],
  task_assigned: ["task", "#tasks"], task_done: ["task", "#tasks"], week_check: ["task", "#tasks"], avail_remind: ["task", "#tasks"],
  creq_new: ["request", "#admin"], creq_approved: ["request", "#calendar"], creq_declined: ["request", "#calendar"], swap_ask: ["request", "#calendar"], tours_change: ["request", "#admin"], dispute_new: ["pay", "#admin"],
  statement: ["pay", "#me"], adjusted: ["pay", "#me"], noshow: ["guest", "#calendar"], event: ["team", "#calendar"], test: ["test", "#me"],
};
const TITLE: Record<string, Record<string, string>> = {
  en: { tour: "Your tours", tomorrow: "Tomorrow", off: "Time off", task: "Tasks", request: "Request", pay: "Pay", guest: "Guests", team: "Team", test: "Notifications are on", other: "Friendly Schedule" },
  ru: { tour: "Ваши туры", tomorrow: "Завтра", off: "Выходные", task: "Задачи", request: "Запрос", pay: "Оплата", guest: "Гости", team: "Команда", test: "Уведомления включены", other: "Friendly Schedule" },
  ka: { tour: "თქვენი ტურები", tomorrow: "ხვალ", off: "დასვენება", task: "დავალებები", request: "მოთხოვნა", pay: "ანაზღაურება", guest: "სტუმრები", team: "გუნდი", test: "შეტყობინებები ჩართულია", other: "Friendly Schedule" },
};
const LOCALE: Record<string, string> = { en: "en-GB", ru: "ru-RU", ka: "ka-GE" };
// "2026-11-11" becomes "Wed, 11 Nov" in the person's language
const niceDate = (v: string, lang: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return v; try { return new Intl.DateTimeFormat(LOCALE[lang] || "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(v + "T12:00:00Z")); } catch { return v; } };

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });
  const { record } = await req.json();
  if (!record?.user_id) return new Response("no record", { status: 400 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await sb.from("profiles").select("lang").eq("id", record.user_id).maybeSingle();
  const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", record.user_id);
  const lang = profile?.lang && TEXT[profile.lang] ? profile.lang : "en";
  const GENERIC: Record<string, string> = { en: "Something new for you in Friendly Schedule.", ru: "Для вас есть новое в Friendly Schedule.", ka: "Friendly Schedule-ში თქვენთვის სიახლეა." };
  const body = (TEXT[lang][record.kind] ?? TEXT.en[record.kind] ?? GENERIC[lang]).replace(/\{(\w+)\}/g, (_: string, k: string) => niceDate(String(record.params?.[k] ?? ""), lang)).replace(/\s+,/g, ",").replace(/[,:]\s*$/, "").trim();
  const [grp, url] = GROUP[record.kind] ?? ["other", "./"], title = TITLE[lang][grp] ?? "Friendly Schedule";
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url: "./" + (url.startsWith("#") ? url : ""), tag: `${record.kind}-${record.params?.date ?? record.id ?? ""}`, lang }));
      sent++;
    } catch (e) {
      // 404/410 mean the phone unsubscribed: remove the dead subscription
      if ((e as { statusCode?: number }).statusCode === 404 || (e as { statusCode?: number }).statusCode === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
