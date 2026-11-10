// Sends a phone notification when a row is added to "notifications".
// Set up once in the Supabase dashboard: see PUSH-SETUP.md.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const TEXT: Record<string, Record<string, string>> = {
  en: { tour_cancelled: "Tour cancelled: {title}, {date}", tour_restored: "Tour is back on: {title}, {date}", tour_tomorrow: "Tomorrow: {title} at {time}", test: "Test notification: it works.", tour_assigned: "New tour for you: {title}, {date} {time}", tour_removed: "You are no longer on: {title}, {date}", tour_changed: "Tour changed: {title} is now {date} {time}", off_requested: "{name} asks for time off: {from} – {to}", sick_reported: "{name} is off sick: {from} – {to}", off_approved: "Time off approved: {from} – {to}", off_declined: "Time off declined: {from} – {to}", task_assigned: "New task: {title}", task_done: "{name} finished: {title}", event: "Team event: {title}", noshow: "No-show: {name}, {title}", creq_new: "{name} suggests a change: {title}, {date}", creq_approved: "Your change was approved: {title}", creq_declined: "Your change was declined: {title}", statement: "Your pay statement for {title} is ready: {time}" },
  ru: { tour_cancelled: "Тур отменён: {title}, {date}", tour_restored: "Тур снова в силе: {title}, {date}", tour_tomorrow: "Завтра: {title} в {time}", test: "Тестовое уведомление: всё работает.", tour_assigned: "Новый тур для вас: {title}, {date} {time}", tour_removed: "Вы больше не на туре: {title}, {date}", tour_changed: "Тур изменён: {title}, теперь {date} {time}", off_requested: "{name} просит выходной: {from} – {to}", sick_reported: "{name} на больничном: {from} – {to}", off_approved: "Выходной утверждён: {from} – {to}", off_declined: "Выходной отклонён: {from} – {to}", task_assigned: "Новая задача: {title}", task_done: "{name} выполнил(а): {title}", event: "Событие команды: {title}", statement: "Ваш расчёт за {title} готов: {time}" },
  ka: { tour_cancelled: "ტური გაუქმდა: {title}, {date}", tour_restored: "ტური აღდგა: {title}, {date}", tour_tomorrow: "ხვალ: {title}, {time}", test: "სატესტო შეტყობინება: მუშაობს.", tour_assigned: "ახალი ტური თქვენთვის: {title}, {date} {time}", tour_removed: "ამ ტურზე აღარ ხართ: {title}, {date}", tour_changed: "ტური შეიცვალა: {title}, ახლა {date} {time}", off_requested: "{name} დასვენებას ითხოვს: {from} – {to}", sick_reported: "{name} ავად არის: {from} – {to}", off_approved: "დასვენება დამტკიცდა: {from} – {to}", off_declined: "დასვენება უარყოფილია: {from} – {to}", task_assigned: "ახალი დავალება: {title}", task_done: "{name}: შესრულდა {title}", event: "გუნდის ღონისძიება: {title}", statement: "თქვენი ანგარიში {title}-ისთვის მზადაა: {time}" },
};

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });
  const { record } = await req.json();
  if (!record?.user_id) return new Response("no record", { status: 400 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await sb.from("profiles").select("lang").eq("id", record.user_id).maybeSingle();
  const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", record.user_id);
  const lang = profile?.lang && TEXT[profile.lang] ? profile.lang : "en";
  const body = (TEXT[lang][record.kind] ?? TEXT.en[record.kind] ?? record.kind).replace(/\{(\w+)\}/g, (_: string, k: string) => record.params?.[k] ?? "");
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: "Friendly Schedule", body }));
      sent++;
    } catch (e) {
      // 404/410 mean the phone unsubscribed: remove the dead subscription
      if ((e as { statusCode?: number }).statusCode === 404 || (e as { statusCode?: number }).statusCode === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
