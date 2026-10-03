-- ─────────────────────────────────────────────────────────────────
-- 113_city_kinds.sql — 도시 «종류»를 새 칸(kinds)에 붙입니다 (2026-10-03, b824)
--
-- **왜.** 068 의 태그는 설명을 LLM 에게 한 번 읽혀 뽑은 것인데, 분석 탭 「여행지 종류별 별점」을
-- 만들며 재 보니 엉성했습니다 — 베네치아 [도시] 하나 · 제주에 해변 없음 · 도쿄·부산 네 개씩 ·
-- 721곳 중 253곳은 태그 없음(068 뒤에 늘린 도시들). 태그가 많으면 종류마다 같은 도시가 섞여
-- 평균이 다 비슷해집니다.
--
-- **기준(사용자와 정함, 2026-10-03).** 「그 도시에 가는 대표 이유」만, 한 도시에 1~3개.
--   해변 바다·해변에서 노는 게 큰 이유 · 자연 산·호수·협곡·섬 경치가 주인공 · 온천 온천이 대표 경험
--   미술 손꼽히는 미술관·박물관 · 유적 옛 건축·궁·성당·고대 유적·구시가 · 미식 먹으러 가는 곳
--   도시 대도시 스카이라인·야경·번화가 자체가 볼거리(화면 이름 「도심」) · 설상 스키·눈(화면 「눈·스키」)
--   축제 이름난 축제가 여행 이유 · 쇼핑 쇼핑이 대표 경험
--   근교 당일치기 볼거리는 안 넣음(그 도시가 거점인 곳은 넣음). 대표 이유가 없거나 갈 수 없는 곳은 빈칸.
--
-- **결과.** 721곳 전부 적습니다(068 tags 와 견줘) — 바뀐 곳 458 · 새로 붙은 곳 207 · 빈칸 253 → 47 ·
--   한 도시 평균 2.10 → 1.62 개 · 도시(도심) 224 → 70곳.
--
-- ⚠⚠ **`tags`(068)는 안 건드립니다 — 추천(rec.js)이 계속 그것을 씁니다.** 새 종류로 바꿔 감추고-맞히기를 재 보니
--   추천이 나빠졌습니다(사용자 기록 해외 21곳 · 같은 후보 467곳: 가운뎃값 15.4% → 22.8% · 상위10% 적중 43% → 33%,
--   태그 안 쓸 때 34.3%). 그래서 둘로 나눕니다(사용자 결정): `tags` = 추천 계산용(그대로) · `kinds` = 화면의 종류
--   (분석 탭 「여행지 종류별 별점」 · 어워즈 「○○ 최애」). 도시 목록은 kinds 를 맨 윗단에서만 받습니다(citysearch.js).
-- 여러 번 돌려도 같습니다. 하나라도 실패하면 통째로 안 바뀝니다(begin … commit).
-- ─────────────────────────────────────────────────────────────────
begin;

alter table public.cities add column if not exists kinds text[] not null default '{}';
comment on column public.cities.kinds is
  '화면에 보이는 도시 종류(113). 해변 자연 온천 미술 유적 미식 도시 설상 축제 쇼핑 중 대표 이유 1~3개.
   추천 계산은 tags(068)를 씁니다 — 둘을 합치면 추천이 나빠집니다(113 머리말).';

-- 유적 — 143곳
update public.cities set kinds = array['유적']::text[] where id in (
  'agra','aleppo','algiers','amman','amritsar','ar-rifa','asmara','assisi','athens','aveiro','ayutthaya',
  'bagan','baghdad','bandarseri','battambang','belfast','bern','bhaktapur','borgo-maggiore','brasilia',
  'bratislava','brno','bucharest','bukhara','buyeo','callao','cambridge','casablanca','cesky','coimbra',
  'cusco','dakar','debrecen','delphi','dhaka','fes','gangjin','ganja','gori','guanajuato','gunsan','gyeongju',
  'haarlem','havana','heidelberg','helsinki','himeji','iasi','iloilo','irbid','jaipur','jeddah','jerusalem',
  'johannesburg','kabul','kathmandu','khiva','kitakyushu','krakow','kumasi','kyiv','lahaina','linkoeping',
  'ljubljana','luanda','lublin','lucca','luxembourg','luxor','maastricht','makassar','mandalay','manila',
  'mashhad','matera','matsue','minsk','mont-saint-michel','moroni','muscat','namwon','nanjing','napier',
  'narva','nicosia','nimes','nitra','odense','okayama','osh','oxford','paramaribo','phnompenh','pisa',
  'prague','quito','rabat','ravenna','regensburg','riga','rothenburg-ob-der-tauber','rouen','sacramento',
  'salamanca','samarkand','sanliurfa','santiago-de-compostela','santo-domingo','sarajevo','selcuk','sharjah',
  'shirakawago','shymkent','siauliai','sibenik','siemreap','sintra','skopje','sofia','sucre','suzhou',
  'tallinn','tangier','tashkent','thimphu','tirana','toledo','utrecht','vaesteras','varanasi','versailles',
  'vientiane','vilnius','warsaw','wroclaw','yangon','yekaterinburg','yeongju','yerevan','yogyakarta','york',
  'zaanse-schans','zadar');

-- 자연 — 104곳
update public.cities set kinds = array['자연']::text[] where id in (
  'akureyri','anchorage','angelescity','antananarivo','antofagasta','apia','bandung','baruun-urt',
  'belize-city','biei','bishkek','bissau','blantyre','boseong','buan','bujumbura','bulawayo','cairns',
  'christchurch','como','curepipe','dalat','danyang','darwin','dili','djibouti','dokdo','donghae','douala',
  'dushanbe','el-calafate','esbjerg','flam','foz-do-iguacu','gaborone','gapyeong','geochang','guayaquil',
  'guilin','halong','hangzhou','hilo','hualien','ica','inje','interlaken','irkutsk','jasper','kailua-kona',
  'kampala','kuching','kunming','lauterbrunnen','luganville','majuro','manado','managua','maseru','medan',
  'monterey','monterrey','nairobi','nakuru','namhae','nantou','nelson','niagara-falls','niksic','nuku-alofa',
  'pakse','palawan','parakou','phoenix','plitvice','pokhara','puerto-montt','quetzaltenango','randers',
  'reykjavik','roseau','san-pedro-de-atacama','sancheong','sanjose','santo-antonio','sapa','shizuoka',
  'stavanger','tekapo','tromso','tulagi','ulaanbaatar','ulleung','ushuaia','uyuni','vangvieng','victoria',
  'vik','wanaka','wando','weno','windhoek','yangpyeong','yellowknife','zhangjiajie');

-- (빈칸) — 47곳
update public.cities set kinds = '{}'::text[] where id in (
  'aktobe','asuncion','baiti','bamako','bangui','benghazi','biratnagar','brazzaville','bydgoszcz','caracas',
  'dar-es-salaam','dnipro','funafuti','gaza','juba','kahului','keflavik','kigali','lae','lome','lubumbashi',
  'malabo','mogadishu','monrovia','n-djamena','nampula','ndola','new-amsterdam','ngerulmud','niamey',
  'nouakchott','novosibirsk','omdurman','orlando','oulu','pingtung','port-de-paix','pretoria','rawalpindi',
  'san-pedro-sula','san-salvador','sanaa','seeb','surat-thani','tarawa','vaduz','vantaa');

-- 해변 — 40곳
update public.cities set kinds = array['해변']::text[] where id in (
  'agadir','bakau','basseterre','batumi','biarritz','boracay','cancun','conakry','dalian','freetown',
  'goldcoast','haleiwa','huahin','jurmala','kingstown','ko-olina','lautoka','libreville','maldonado','male',
  'mar-del-plata','miami','mykonos','nadi','nassau','negombo','netanya','newcastle','nice','pattaya',
  'saint-george-s','saint-john-s','sihanoukville','sliema','tahiti','victoria-sc','vungtau','weihai',
  'yangyang','yantai');

-- 유적,미식 — 28곳
update public.cities set kinds = array['유적','미식']::text[] where id in (
  'andong','bari','beijing','boston','bruges','delhi','genoa','granada','hanoi','hiroshima','hue','incheon',
  'izumo','jiufen','leuven','lisbon','macau','malacca','odawara','palermo','porto','segovia','suwon','tainan',
  'tianjin','toulouse','uji','xian');

-- 유적,자연 — 22곳
update public.cities set kinds = array['유적','자연']::text[] where id in (
  'arequipa','aswan','bergen','chiangrai','fussen','ganghwa','gochang','kanchanaburi','kandy','kyoto',
  'lijiang','luangprabang','matsumoto','meteora','nara','nikko','petra','ronda','salta','trabzon','udaipur',
  'yeongwol');

-- 유적,미술 — 16곳
update public.cities set kinds = array['유적','미술']::text[] where id in (
  'abudhabi','aix-en-provence','ankara','arles','bogota','cairo','delft','ghent','graz','gyumri','moscow',
  'stockholm','tunis','valletta','valparaiso','venice');

-- 유적,축제 — 15곳
update public.cities set kinds = array['유적','축제']::text[] where id in (
  'avignon','braga','cologne','cordoba','dresden','edinburgh','gongju','quebec','salvador','salzburg',
  'seville','siena','strasbourg','takayama','verona');

-- 자연,유적 — 15곳
update public.cities set kinds = array['자연','유적']::text[] where id in (
  'annecy','bled','cappadocia','catania','cinqueterre','copacabana-bo','dunedin','goereme','hallstatt',
  'lausanne','lucerne','mungyeong','sigulda','suncheon','ulsan');

-- 도시 — 14곳
update public.cities set kinds = array['도시']::text[] where id in (
  'abidjan','ashgabat','astana','atlanta','auckland','bengaluru','colombo','frankfurt','hamburg',
  'kuwait-city','lagos-ng','liverpool','rotterdam','sanfrancisco');

-- 해변,자연 — 14곳
update public.cities set kinds = array['해변','자연']::text[] where id in (
  'danang','fethiye','hurghada','ishigaki','kenting','kohsamui','krabi','lagos','miyakojima','perth',
  'phanthiet','phuket','positano','sandiego');

-- 미식 — 12곳
update public.cities set kinds = array['미식']::text[] where id in (
  'beirut','chisinau','daegu','daejeon','dallas','gothenburg','haiphong','ipoh','mokpo','shimonoseki',
  'taichung','vladivostok');

-- 자연,설상 — 12곳
update public.cities set kinds = array['자연','설상']::text[] where id in (
  'almaty','banff','chamonix-mont-blanc','denver','furano','grindelwald','liberec','queenstown','rovaniemi',
  'saltlakecity','zell-am-see','zermatt');

-- 도시,미식 — 11곳
update public.cities set kinds = array['도시','미식']::text[] where id in (
  'buenosaires','chicago','chongqing','copenhagen','hakodate','kualalumpur','nashville','shanghai',
  'singapore','toronto','yokohama');

-- 미술 — 11곳
update public.cities set kinds = array['미술']::text[] where id in (
  'addis-ababa','basel','detroit','glasgow','guatemala-city','icheon','kaohsiung','kingston','las-tunas',
  'minneapolis','oslo');

-- 미식,자연 — 11곳
update public.cities set kinds = array['미식','자연']::text[] where id in (
  'adelaide','chengdu','chiayi','chuncheon','davao','mendoza','pohang','sasebo','tongyeong','valdivia','yeosu');

-- 유적,해변 — 11곳
update public.cities set kinds = array['유적','해변']::text[] where id in (
  'alexandria','cartagena','dubrovnik','galle','gdansk','izmir','kamakura','rhodes','split','xiamen',
  'zanzibar');

-- 자연,해변 — 10곳
update public.cities set kinds = array['자연','해변']::text[] where id in (
  'bohol','capetown','castries','elnido','geoje','kotakinabalu','lombok','samcheok','santorini','seogwipo');

-- 미식,유적 — 9곳
update public.cities set kinds = array['미식','유적']::text[] where id in (
  'bologna','bordeaux','brussels','dublin','jeonju','lima','nagoya','naples','penang');

-- 축제 — 9곳
update public.cities set kinds = array['축제']::text[] where id in (
  'bacolod-city','changwon','lobamba','mindelo','novi-sad','ostrava','ouagadougou','port-of-spain',
  'santiago-de-cuba');

-- 해변,유적 — 9곳
update public.cities set kinds = array['해변','유적']::text[] where id in (
  'bridgetown','goa','ibiza','okinawa','quinhon','saipan','sousse','tulum','varna');

-- 미술,미식 — 6곳
update public.cities set kinds = array['미술','미식']::text[] where id in (
  'bilbao','gwangju','houston','madrid','turin','wellington');

-- 해변,미식 — 5곳
update public.cities set kinds = array['해변','미식']::text[] where id in (
  'durban','gangneung','montevideo','rovinj','sorrento');

-- 온천,자연 — 4곳
update public.cities set kinds = array['온천','자연']::text[] where id in (
  'bad-ischl','hakone','rotorua','yilan');

-- 유적,미술,미식 — 4곳
update public.cities set kinds = array['유적','미술','미식']::text[] where id in (
  'mexicocity','philadelphia','rome','vienna');

-- 해변,쇼핑 — 4곳
update public.cities set kinds = array['해변','쇼핑']::text[] where id in (
  'brighton','guam','phuquoc','sanya');

-- 해변,자연,유적 — 4곳
update public.cities set kinds = array['해변','자연','유적']::text[] where id in (
  'bali','cebu','faro','mallorca');

-- 미술,유적 — 3곳
update public.cities set kinds = array['미술','유적']::text[] where id in (
  'kurashiki','saint-petersburg','vatican-city');

-- 미술,축제 — 3곳
update public.cities set kinds = array['미술','축제']::text[] where id in (
  'canberra','linz','stuttgart');

-- 미식,도시 — 3곳
update public.cities set kinds = array['미식','도시']::text[] where id in (
  'fukuoka','guangzhou','melbourne');

-- 미식,축제 — 3곳
update public.cities set kinds = array['미식','축제']::text[] where id in (
  'asahikawa','neworleans','valencia');

-- 쇼핑 — 3곳
update public.cities set kinds = array['쇼핑']::text[] where id in (
  'batam','ciudad-del-este','johorbahru');

-- 유적,도시 — 3곳
update public.cities set kinds = array['유적','도시']::text[] where id in (
  'baku','belgrade','panama-city');

-- 유적,미식,도시 — 3곳
update public.cities set kinds = array['유적','미식','도시']::text[] where id in (
  'bangkok','istanbul','nagasaki');

-- 유적,미식,축제 — 3곳
update public.cities set kinds = array['유적','미식','축제']::text[] where id in (
  'chiangmai','guadalajara','otaru');

-- 유적,축제,미식 — 3곳
update public.cities set kinds = array['유적','축제','미식']::text[] where id in (
  'colmar','kolkata','nuremberg');

-- 자연,미식 — 3곳
update public.cities set kinds = array['자연','미식']::text[] where id in (
  'damyang','seattle','yanji');

-- 자연,축제 — 3곳
update public.cities set kinds = array['자연','축제']::text[] where id in (
  'locarno','madeira','taitung');

-- 자연,해변,미식 — 3곳
update public.cities set kinds = array['자연','해변','미식']::text[] where id in (
  'amalfi','jeju','sokcho');

-- 축제,자연 — 3곳
update public.cities set kinds = array['축제','자연']::text[] where id in (
  'ambato','calgary','galway');

-- 도시,미식,쇼핑 — 2곳
update public.cities set kinds = array['도시','미식','쇼핑']::text[] where id in (
  'hongkong','tokyo');

-- 도시,쇼핑,자연 — 2곳
update public.cities set kinds = array['도시','쇼핑','자연']::text[] where id in (
  'dubai','lasvegas');

-- 도시,해변 — 2곳
update public.cities set kinds = array['도시','해변']::text[] where id in (
  'brisbane','losangeles');

-- 미술,유적,도시 — 2곳
update public.cities set kinds = array['미술','유적','도시']::text[] where id in (
  'amsterdam','london');

-- 미술,유적,미식 — 2곳
update public.cities set kinds = array['미술','유적','미식']::text[] where id in (
  'florence','paris');

-- 미식,도시,온천 — 2곳
update public.cities set kinds = array['미식','도시','온천']::text[] where id in (
  'kobe','taipei');

-- 미식,유적,축제 — 2곳
update public.cities set kinds = array['미식','유적','축제']::text[] where id in (
  'lyon','oaxaca');

-- 미식,축제,유적 — 2곳
update public.cities set kinds = array['미식','축제','유적']::text[] where id in (
  'montreal','sendai');

-- 쇼핑,도시 — 2곳
update public.cities set kinds = array['쇼핑','도시']::text[] where id in (
  'jakarta','shenzhen');

-- 온천 — 2곳
update public.cities set kinds = array['온천']::text[] where id in (
  'beppu','karlovyvary');

-- 온천,유적 — 2곳
update public.cities set kinds = array['온천','유적']::text[] where id in (
  'bath','matsuyama');

-- 유적,쇼핑 — 2곳
update public.cities set kinds = array['유적','쇼핑']::text[] where id in (
  'hoian','marrakech');

-- 자연,도시 — 2곳
update public.cities set kinds = array['자연','도시']::text[] where id in (
  'geneva','lapaz');

-- 자연,미술 — 2곳
update public.cities set kinds = array['자연','미술']::text[] where id in (
  'tottorishi','ubud');

-- 자연,온천,유적 — 2곳
update public.cities set kinds = array['자연','온천','유적']::text[] where id in (
  'huangshan','pamukkale');

-- 축제,미식,도시 — 2곳
update public.cities set kinds = array['축제','미식','도시']::text[] where id in (
  'austin','munich');

-- 해변,유적,자연 — 2곳
update public.cities set kinds = array['해변','유적','자연']::text[] where id in (
  'antalya','corfu');

-- 해변,자연,쇼핑 — 2곳
update public.cities set kinds = array['해변','자연','쇼핑']::text[] where id in (
  'honolulu','langkawi');

-- 도시,미술 — 1곳
update public.cities set kinds = array['도시','미술']::text[] where id in (
  'medellin');

-- 도시,미술,미식 — 1곳
update public.cities set kinds = array['도시','미술','미식']::text[] where id in (
  'saopaulo');

-- 도시,쇼핑 — 1곳
update public.cities set kinds = array['도시','쇼핑']::text[] where id in (
  'manchester');

-- 도시,쇼핑,미술 — 1곳
update public.cities set kinds = array['도시','쇼핑','미술']::text[] where id in (
  'zurich');

-- 도시,유적 — 1곳
update public.cities set kinds = array['도시','유적']::text[] where id in (
  'mumbai');

-- 도시,유적,쇼핑 — 1곳
update public.cities set kinds = array['도시','유적','쇼핑']::text[] where id in (
  'seoul');

-- 도시,자연 — 1곳
update public.cities set kinds = array['도시','자연']::text[] where id in (
  'santiago');

-- 도시,자연,유적 — 1곳
update public.cities set kinds = array['도시','자연','유적']::text[] where id in (
  'riyadh');

-- 도시,축제 — 1곳
update public.cities set kinds = array['도시','축제']::text[] where id in (
  'monaco');

-- 도시,해변,자연 — 1곳
update public.cities set kinds = array['도시','해변','자연']::text[] where id in (
  'sydney');

-- 미술,도시,쇼핑 — 1곳
update public.cities set kinds = array['미술','도시','쇼핑']::text[] where id in (
  'newyork');

-- 미술,쇼핑,도시 — 1곳
update public.cities set kinds = array['미술','쇼핑','도시']::text[] where id in (
  'doha');

-- 미술,유적,쇼핑 — 1곳
update public.cities set kinds = array['미술','유적','쇼핑']::text[] where id in (
  'antwerp');

-- 미술,유적,축제 — 1곳
update public.cities set kinds = array['미술','유적','축제']::text[] where id in (
  'washington');

-- 미술,자연 — 1곳
update public.cities set kinds = array['미술','자연']::text[] where id in (
  'hobart');

-- 미술,해변 — 1곳
update public.cities set kinds = array['미술','해변']::text[] where id in (
  'thehague');

-- 미식,도시,쇼핑 — 1곳
update public.cities set kinds = array['미식','도시','쇼핑']::text[] where id in (
  'osaka');

-- 미식,도시,유적 — 1곳
update public.cities set kinds = array['미식','도시','유적']::text[] where id in (
  'hochiminh');

-- 미식,미술 — 1곳
update public.cities set kinds = array['미식','미술']::text[] where id in (
  'takamatsu');

-- 미식,설상 — 1곳
update public.cities set kinds = array['미식','설상']::text[] where id in (
  'niigata');

-- 미식,설상,축제 — 1곳
update public.cities set kinds = array['미식','설상','축제']::text[] where id in (
  'sapporo');

-- 미식,해변,축제 — 1곳
update public.cities set kinds = array['미식','해변','축제']::text[] where id in (
  'sansebastian');

-- 설상,자연 — 1곳
update public.cities set kinds = array['설상','자연']::text[] where id in (
  'whistler');

-- 쇼핑,미술,도시 — 1곳
update public.cities set kinds = array['쇼핑','미술','도시']::text[] where id in (
  'milan');

-- 쇼핑,미식 — 1곳
update public.cities set kinds = array['쇼핑','미식']::text[] where id in (
  'duesseldorf');

-- 쇼핑,설상,자연 — 1곳
update public.cities set kinds = array['쇼핑','설상','자연']::text[] where id in (
  'andorra-la-vella');

-- 온천,미식,유적 — 1곳
update public.cities set kinds = array['온천','미식','유적']::text[] where id in (
  'tbilisi');

-- 온천,유적,도시 — 1곳
update public.cities set kinds = array['온천','유적','도시']::text[] where id in (
  'budapest');

-- 온천,자연,쇼핑 — 1곳
update public.cities set kinds = array['온천','자연','쇼핑']::text[] where id in (
  'yufuin');

-- 유적,미술,도시 — 1곳
update public.cities set kinds = array['유적','미술','도시']::text[] where id in (
  'berlin');

-- 유적,미술,축제 — 1곳
update public.cities set kinds = array['유적','미술','축제']::text[] where id in (
  'ottawa');

-- 유적,미식,미술 — 1곳
update public.cities set kinds = array['유적','미식','미술']::text[] where id in (
  'kanazawa');

-- 유적,미식,해변 — 1곳
update public.cities set kinds = array['유적','미식','해변']::text[] where id in (
  'barcelona');

-- 유적,설상 — 1곳
update public.cities set kinds = array['유적','설상']::text[] where id in (
  'bursa');

-- 유적,온천,설상 — 1곳
update public.cities set kinds = array['유적','온천','설상']::text[] where id in (
  'nagano');

-- 유적,온천,자연 — 1곳
update public.cities set kinds = array['유적','온천','자연']::text[] where id in (
  'kumamoto');

-- 유적,자연,축제 — 1곳
update public.cities set kinds = array['유적','자연','축제']::text[] where id in (
  'hirosaki');

-- 유적,해변,자연 — 1곳
update public.cities set kinds = array['유적','해변','자연']::text[] where id in (
  'crete');

-- 자연,도시,설상 — 1곳
update public.cities set kinds = array['자연','도시','설상']::text[] where id in (
  'vancouver');

-- 자연,설상,유적 — 1곳
update public.cities set kinds = array['자연','설상','유적']::text[] where id in (
  'innsbruck');

-- 자연,쇼핑,미식 — 1곳
update public.cities set kinds = array['자연','쇼핑','미식']::text[] where id in (
  'portland');

-- 자연,온천,미식 — 1곳
update public.cities set kinds = array['자연','온천','미식']::text[] where id in (
  'kagoshima');

-- 자연,온천,설상 — 1곳
update public.cities set kinds = array['자연','온천','설상']::text[] where id in (
  'pucon');

-- 자연,축제,유적 — 1곳
update public.cities set kinds = array['자연','축제','유적']::text[] where id in (
  'montreux');

-- 축제,설상 — 1곳
update public.cities set kinds = array['축제','설상']::text[] where id in (
  'aomori');

-- 축제,설상,유적 — 1곳
update public.cities set kinds = array['축제','설상','유적']::text[] where id in (
  'harbin');

-- 축제,유적 — 1곳
update public.cities set kinds = array['축제','유적']::text[] where id in (
  'zagreb');

-- 해변,도시 — 1곳
update public.cities set kinds = array['해변','도시']::text[] where id in (
  'telaviv');

-- 해변,미술,미식 — 1곳
update public.cities set kinds = array['해변','미술','미식']::text[] where id in (
  'malaga');

-- 해변,미식,도시 — 1곳
update public.cities set kinds = array['해변','미식','도시']::text[] where id in (
  'busan');

-- 해변,온천 — 1곳
update public.cities set kinds = array['해변','온천']::text[] where id in (
  'nhatrang');

-- 해변,유적,미식 — 1곳
update public.cities set kinds = array['해변','유적','미식']::text[] where id in (
  'chennai');

-- 해변,자연,미식 — 1곳
update public.cities set kinds = array['해변','자연','미식']::text[] where id in (
  'marseille');

-- 해변,자연,축제 — 1곳
update public.cities set kinds = array['해변','자연','축제']::text[] where id in (
  'rio');

-- 해변,축제 — 1곳
update public.cities set kinds = array['해변','축제']::text[] where id in (
  'boryeong');

-- 해변,축제,미식 — 1곳
update public.cities set kinds = array['해변','축제','미식']::text[] where id in (
  'qingdao');

commit;

-- ── 확인(결과만 보는 줄입니다) ── 종류마다 몇 곳인지 · 빈칸이 몇 곳인지
--   기대값: 유적 329 · 자연 238 · 미식 137 · 해변 120 · 도시 70 · 미술 64 · 축제 61 · 쇼핑 29 · 설상 23 · 온천 20 · 빈칸 47
select t as 종류, count(*) as 곳 from public.cities, unnest(kinds) t group by t order by 2 desc;
select count(*) filter (where coalesce(array_length(kinds, 1), 0) = 0) as 빈칸,
       count(*) as 전체 from public.cities;
