-- 재기만(읽기 전용) · 평가하다 어디서 그만두나 (10-14) — 관리자·통계 제외 계정 빼고
-- 결과 표 셋: ① 몇 곳에서 멈췄나  ② 첫날 몇 곳 매기고 다시 왔나  ③ 사람마다(이름 없이)
with u as (
  select p.id, p.created_at::date as 가입일
    from public.profiles p
   where p.id not in (select user_id from public.stat_skip)
),
r as (
  select u.id,
         count(*) filter (where c.stars is not null)                          as 별,
         count(*) filter (where c.want and c.stars is null)                   as 하트만,
         count(*) filter (where c.stars is not null and c.created_at::date = u.가입일) as 첫날별,
         min(c.created_at) filter (where c.stars is not null)                 as 첫별,
         max(c.created_at) filter (where c.stars is not null)                 as 마지막별,
         count(distinct c.created_at::date) filter (where c.stars is not null) as 별준날수
    from u left join public.city_ratings c on c.user_id = u.id
   group by u.id, u.가입일
),
d as (select user_id, count(*) as 연날수 from public.user_days group by user_id)
select '① 멈춘 곳' as 표,
       case when 별 = 0 then '0곳' when 별 <= 2 then '1~2곳' when 별 <= 4 then '3~4곳'
            when 별 <= 9 then '5~9곳' when 별 <= 19 then '10~19곳' else '20곳+' end as 칸,
       count(*) as 사람, round(avg(coalesce(d.연날수, 0)), 1) as 평균_연날수, null::text as 덧
  from r left join d on d.user_id = r.id
 group by 2
union all
select '② 첫날',
       case when 첫날별 = 0 then '첫날 0곳' when 첫날별 <= 4 then '첫날 1~4곳'
            when 첫날별 <= 9 then '첫날 5~9곳' else '첫날 10곳+' end,
       count(*), round(avg(coalesce(d.연날수, 0)), 1),
       '다음에 또 매긴 사람 ' || count(*) filter (where 별준날수 >= 2)
  from r left join d on d.user_id = r.id
 group by 2
union all
select '③ 사람', '별 ' || 별 || ' · 하트 ' || 하트만 || ' · 첫날 ' || 첫날별,
       별준날수, coalesce(d.연날수, 0),
       to_char(첫별 at time zone 'Asia/Seoul', 'MM-DD HH24:MI') || ' → ' ||
       to_char(마지막별 at time zone 'Asia/Seoul', 'MM-DD HH24:MI') ||
       ' (' || coalesce(round(extract(epoch from 마지막별 - 첫별) / 60)::text, '-') || '분)'
  from r left join d on d.user_id = r.id
 order by 1, 3 desc;
