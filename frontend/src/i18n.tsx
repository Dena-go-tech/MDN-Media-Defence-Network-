import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { langStore, type Lang } from './api'

// Portal interface strings. The admin panel stays in Russian.
const ru = {
  'nav.main': 'Основное меню',
  'nav.news': 'Новости',
  'nav.tests': 'Тесты',
  'nav.assistant': 'Ассистент',
  'nav.profile': 'Профиль',
  'nav.login': 'Войти',
  'nav.admin': 'Админка',
  'header.cta': 'Пройти тест',
  'header.exitTest': 'Выйти из теста',
  'header.lang': 'Язык сайта',
  'footer.links': 'Ссылки в подвале',
  'footer.assistant': 'ИИ-ассистент',

  'common.loading': 'Загрузка…',
  'common.notFound': 'Не найдено',
  'common.min': 'мин',
  'common.minRead': 'мин чтения',
  'common.summary': 'Кратко',
  'common.ask': 'Спросить',
  'common.back': 'Назад',
  'common.score': '{s} из {t}',
  'common.since': 'с {date}',

  'home.kicker': 'Информационный портал для медиа',
  'home.title1': 'Знайте свои права. Проверяйте знания.',
  'home.title2': 'Защищайте слово.',
  'home.lede': 'Новости о свободе слова и медиаправе, короткие тесты для журналистов и редакций и ИИ-ассистент, который отвечает со ссылкой на источник.',
  'home.search': 'Проверить новость или задать вопрос о медиаправе',
  'home.searchLabel': 'Проверить новость или задать вопрос',
  'home.q1': 'Закон о СМИ',
  'home.q2': 'Цифровая безопасность',
  'home.q3': 'Что делать при давлении',
  'home.featured': 'Главная тема',
  'home.fresh': 'Свежее',
  'home.read': 'Читать',
  'home.empty': 'Новостей пока нет.',
  'home.news': 'Новости',
  'home.all': 'Все',
  'home.rubrics': 'Рубрики',
  'home.testsTitle': 'Тесты и самопроверка',
  'home.testsLede': 'Каждый пройденный тест сохраняется в вашем профиле и попадает в аналитику сети: так редакции и тренеры видят, какие темы требуют внимания.',
  'home.step1': 'Проходите тест',
  'home.step2': 'Результат уходит в аналитику',
  'home.step3': 'Разбор ошибок сразу после теста',
  'home.allTests': 'Все тесты',
  'home.promoTag': 'ИИ-ассистент BulbAI',
  'home.promoTitle': 'Проверит новость или сообщение до того, как вы её перешлёте',
  'home.promoText': 'Ассистент разбирает слухи, подозрительные SMS и фото, пересказывает новости и объясняет ошибки в тестах. Это подсказка, а не окончательный вердикт.',
  'home.promoOpen': 'Открыть ассистента',
  'home.promoInput': 'Вставьте новость, сообщение или ссылку',
  'home.promoInputLabel': 'Ваш вопрос',
  'home.send': 'Отправить',
  'home.aiWarn': 'ИИ может ошибаться. Проверяйте важное по первоисточнику.',
  'home.surveyTag': 'Опрос',
  'home.surveyText': 'Анонимно, около {m} мин. Ответы помогут сети делать полезные материалы.',
  'home.surveyGo': 'Пройти опрос',

  'verdict.verified': 'Вердикт: подтверждено',
  'verdict.fake': 'Вердикт: фейк',
  'verdict.doubt': 'Вердикт: не подтверждено',
  'verdict.warning': 'Вердикт: осторожно',

  'article.crumbs': 'Навигация',
  'article.material': 'Материал',
  'article.checkTag': 'Проверьте понимание',
  'article.checkText': '{q}. Результат сохранится в профиле.',
  'article.takeTest': 'Пройти тест',
  'article.askTitle': 'Спросить ИИ об этой статье',
  'article.askPlaceholder': 'Что это значит для фрилансера?',
  'article.askLabel': 'Вопрос',
  'article.askSuffix': '{q} (по статье «{title}»)',
  'article.related': 'Читайте также',

  'tests.title': 'Тесты и самопроверка',
  'tests.lede': 'Проверьте свои знания в области медиаправа, медиаграмотности и цифровой безопасности. Результаты сохраняются в профиле.',
  'tests.empty': 'Тестов пока нет.',
  'tests.surveys': 'Опросы',
  'tests.surveysLede': 'Анонимные опросы сети: без регистрации, сохраняются только выбранные варианты.',
  'tests.quizzes': 'Тесты',
  'tests.meta': '{q} · около {m} мин',
  'tests.start': 'Начать',
  'tests.survey': 'Опрос',
  'tests.anonymous': 'Анонимно',
  'tests.surveyStart': 'Пройти опрос',
  'tests.surveyDone': 'Вы уже ответили',

  'run.loginTitle': 'Войдите, чтобы пройти тест',
  'run.loginText': 'Результат сохранится в профиле и попадёт в аналитику сети.',
  'run.result': 'Результат',
  'run.good': 'Хороший результат. Тема усвоена, можно переходить к следующему тесту.',
  'run.bad': 'Стоит перечитать материалы по теме. ИИ-ассистент подскажет, с чего начать.',
  'run.review': 'Разбор ответов',
  'run.again': 'Пройти ещё раз',
  'run.myResults': 'Мои результаты',
  'run.question': 'Вопрос {n} из {t}',
  'run.finish': 'Завершить тест',
  'run.next': 'Следующий вопрос',

  'survey.multiple': 'Можно выбрать несколько вариантов',
  'survey.optional': 'Необязательный вопрос',
  'survey.skip': 'Пропустить',
  'survey.send': 'Отправить ответы',
  'survey.thanks': 'Спасибо за ответы!',
  'survey.thanksText': 'Опрос анонимный: мы сохранили только выбранные варианты. Ответы помогут сети делать полезные и понятные материалы.',
  'survey.done': 'Вы уже прошли этот опрос',
  'survey.doneText': 'Спасибо! Ответ с этого устройства уже сохранён.',
  'survey.again': 'Ответить ещё раз',
  'survey.toTests': 'К тестам',
  'survey.intro': 'Анонимно · {q} · около {m} мин',
  'survey.begin': 'Начать опрос',

  'profile.logout': 'Выйти',
  'profile.passed': 'Пройдено тестов',
  'profile.avg': 'Средний балл',
  'profile.results': 'Мои результаты',
  'profile.empty': 'Вы ещё не проходили тесты.',
  'profile.toTests': 'Перейти к тестам',
  'profile.test': 'Тест',
  'profile.result': 'Результат',
  'profile.date': 'Дата',
  'profile.breakdown': 'Разбор →',
  'profile.backResults': '← Мои результаты',
  'profile.retake': 'Пройти тест ещё раз',
  'profile.askBulb': 'Спросить BulbAI',
  'profile.askBulbQ': 'Объясни мои ошибки в тесте «{title}»',

  'summary.right': 'Верно: {n}',
  'summary.wrongCount': 'Ошибок: {n}',
  'summary.wrong': 'Ошибки ({n})',
  'summary.noWrong': 'Ошибок нет',
  'summary.allRight': 'Все ответы верные.',
  'summary.rightList': 'Верные ответы ({n})',
  'summary.answer': 'Ответ',
  'summary.noAnswer': 'Нет ответа',
  'summary.correct': 'Верный ответ',
  'summary.isCorrect': 'Ответ верный',
  'summary.noDetails': 'Подробностей по этой попытке нет: она сохранена до того, как начали записываться ответы.',

  'login.title': 'Вход',
  'login.register': 'Регистрация',
  'login.name': 'Имя',
  'login.password': 'Пароль',
  'login.submit': 'Войти',
  'login.submitRegister': 'Зарегистрироваться',
  'login.toRegister': 'Нет аккаунта? Зарегистрироваться',
  'login.toLogin': 'Уже есть аккаунт? Войти',

  'ai.verified': '✓ Подтверждено',
  'ai.fake': '✕ Фейк',
  'ai.doubt': '? Не подтверждено',
  'ai.warning': '! Осторожно',
  'ai.ex1': 'В WhatsApp пишут, что с завтрашнего дня в Бишкеке отключат мобильный интернет на неделю. Это правда?',
  'ai.ex2': 'Как отличить фейковую фотографию от настоящей?',
  'ai.ex3': 'Мне пришла SMS «Ваша карта заблокирована, перейдите по ссылке». Что делать?',
  'ai.greeting': 'Привет! Я BulbAI. Пришлите новость, сообщение или ссылку, и я помогу проверить, правда это или фейк.',
  'ai.demoFallback': 'Пока я работаю в демо-режиме и отвечаю только на подготовленные вопросы. Выберите один из вопросов ниже, а скоро я научусь проверять любые сообщения.',
  'ai.material': 'материал на сайте',
  'ai.restart': 'Хорошо, начнём заново. Что проверим?',
  'ai.analyze': 'Анализирую…',
  'ai.search': 'Ищу источники…',
  'ai.speak': 'Отвечаю…',
  'ai.ready': 'Готов помочь',
  'ai.voiceOn': 'Голос включён',
  'ai.voiceOff': 'Голос выключен',
  'ai.title': 'ИИ-ассистент',
  'ai.demo': 'Демо',
  'ai.demoText': 'Демонстрация будущего ассистента: ответы подготовлены заранее.',
  'ai.liveText': 'Проверка новостей и сообщений на достоверность. Ассистент может ошибаться: проверяйте важное по первоисточникам.',
  'ai.newChat': 'Новый чат',
  'ai.thinking': 'Думаю…',
  'ai.more': 'Ещё вопросы',
  'ai.try': 'Попробуйте спросить',
  'ai.placeholder': 'Вставьте новость, сообщение или ссылку…',
  'ai.check': 'Проверить',
  'ai.loginBefore': '',
  'ai.loginLink': 'Войдите',
  'ai.loginAfter': ', чтобы пользоваться ассистентом.',
}

export type TKey = keyof typeof ru

const ky: Record<TKey, string> = {
  'nav.main': 'Негизги меню',
  'nav.news': 'Жаңылыктар',
  'nav.tests': 'Тесттер',
  'nav.assistant': 'Жардамчы',
  'nav.profile': 'Профиль',
  'nav.login': 'Кирүү',
  'nav.admin': 'Админка',
  'header.cta': 'Тест тапшыруу',
  'header.exitTest': 'Тесттен чыгуу',
  'header.lang': 'Сайттын тили',
  'footer.links': 'Шилтемелер',
  'footer.assistant': 'ЖИ-жардамчы',

  'common.loading': 'Жүктөлүүдө…',
  'common.notFound': 'Табылган жок',
  'common.min': 'мүн',
  'common.minRead': 'мүн окуу',
  'common.summary': 'Кыскача',
  'common.ask': 'Суроо',
  'common.back': 'Артка',
  'common.score': '{s} / {t}',
  'common.since': '{date} бери',

  'home.kicker': 'Медиа үчүн маалыматтык портал',
  'home.title1': 'Укугуңузду билиңиз. Билимиңизди текшериңиз.',
  'home.title2': 'Сөздү коргоңуз.',
  'home.lede': 'Сөз эркиндиги жана медиа укук тууралуу жаңылыктар, журналисттер менен редакциялар үчүн кыска тесттер жана булакка шилтеме берип жооп берген ЖИ-жардамчы.',
  'home.search': 'Жаңылыкты текшерүү же медиа укук боюнча суроо берүү',
  'home.searchLabel': 'Жаңылыкты текшерүү же суроо берүү',
  'home.q1': 'ЖМК жөнүндө мыйзам',
  'home.q2': 'Санариптик коопсуздук',
  'home.q3': 'Басым көрсөтүлсө эмне кылуу керек',
  'home.featured': 'Башкы тема',
  'home.fresh': 'Жаңы',
  'home.read': 'Окуу',
  'home.empty': 'Азырынча жаңылыктар жок.',
  'home.news': 'Жаңылыктар',
  'home.all': 'Баары',
  'home.rubrics': 'Рубрикалар',
  'home.testsTitle': 'Тесттер жана өзүн-өзү текшерүү',
  'home.testsLede': 'Ар бир тапшырылган тест профилиңизде сакталып, тармактын аналитикасына түшөт: ушундайча редакциялар жана тренерлер кайсы темаларга көңүл буруу керектигин көрүшөт.',
  'home.step1': 'Тест тапшырасыз',
  'home.step2': 'Жыйынтык аналитикага түшөт',
  'home.step3': 'Тесттен кийин дароо каталар талданат',
  'home.allTests': 'Бардык тесттер',
  'home.promoTag': 'BulbAI ЖИ-жардамчысы',
  'home.promoTitle': 'Жаңылыкты же билдирүүнү башкаларга жөнөтүүдөн мурун текшерип берет',
  'home.promoText': 'Жардамчы ушактарды, шектүү SMS жана сүрөттөрдү талдайт, жаңылыктарды кыскача айтып берет жана тесттеги каталарды түшүндүрөт. Бул акыркы чечим эмес, кеңеш гана.',
  'home.promoOpen': 'Жардамчыны ачуу',
  'home.promoInput': 'Жаңылыкты, билдирүүнү же шилтемени коюңуз',
  'home.promoInputLabel': 'Сурооңуз',
  'home.send': 'Жөнөтүү',
  'home.aiWarn': 'ЖИ жаңылышы мүмкүн. Маанилүү маалыматты баштапкы булактан текшериңиз.',
  'home.surveyTag': 'Сурамжылоо',
  'home.surveyText': 'Анонимдүү, болжол менен {m} мүнөт. Жоопторуңуз тармакка пайдалуу материалдарды даярдоого жардам берет.',
  'home.surveyGo': 'Сурамжылоого катышуу',

  'verdict.verified': 'Чечим: тастыкталды',
  'verdict.fake': 'Чечим: фейк',
  'verdict.doubt': 'Чечим: тастыкталган жок',
  'verdict.warning': 'Чечим: этият болуңуз',

  'article.crumbs': 'Навигация',
  'article.material': 'Материал',
  'article.checkTag': 'Түшүнгөнүңүздү текшериңиз',
  'article.checkText': '{q}. Жыйынтык профилде сакталат.',
  'article.takeTest': 'Тест тапшыруу',
  'article.askTitle': 'Бул макала боюнча ЖИден суроо',
  'article.askPlaceholder': 'Бул фрилансер үчүн эмнени билдирет?',
  'article.askLabel': 'Суроо',
  'article.askSuffix': '{q} («{title}» макаласы боюнча)',
  'article.related': 'Дагы окуңуз',

  'tests.title': 'Тесттер жана өзүн-өзү текшерүү',
  'tests.lede': 'Медиа укук, медиасабаттуулук жана санариптик коопсуздук боюнча билимиңизди текшериңиз. Жыйынтыктар профилде сакталат.',
  'tests.empty': 'Азырынча тесттер жок.',
  'tests.surveys': 'Сурамжылоолор',
  'tests.surveysLede': 'Тармактын анонимдүү сурамжылоолору: катталуунун кереги жок, тандалган варианттар гана сакталат.',
  'tests.quizzes': 'Тесттер',
  'tests.meta': '{q} · болжол менен {m} мүн',
  'tests.start': 'Баштоо',
  'tests.survey': 'Сурамжылоо',
  'tests.anonymous': 'Анонимдүү',
  'tests.surveyStart': 'Катышуу',
  'tests.surveyDone': 'Сиз жооп бердиңиз',

  'run.loginTitle': 'Тест тапшыруу үчүн кириңиз',
  'run.loginText': 'Жыйынтык профилде сакталып, тармактын аналитикасына түшөт.',
  'run.result': 'Жыйынтык',
  'run.good': 'Жакшы жыйынтык. Тема өздөштүрүлдү, кийинки тестке өтсөңүз болот.',
  'run.bad': 'Тема боюнча материалдарды кайра окуп чыгуу керек. ЖИ-жардамчы эмнеден баштоону айтып берет.',
  'run.review': 'Жоопторду талдоо',
  'run.again': 'Кайра тапшыруу',
  'run.myResults': 'Менин жыйынтыктарым',
  'run.question': 'Суроо {n} / {t}',
  'run.finish': 'Тестти аяктоо',
  'run.next': 'Кийинки суроо',

  'survey.multiple': 'Бир нече вариантты тандоого болот',
  'survey.optional': 'Милдеттүү эмес суроо',
  'survey.skip': 'Өткөрүп жиберүү',
  'survey.send': 'Жоопторду жөнөтүү',
  'survey.thanks': 'Жоопторуңуз үчүн рахмат!',
  'survey.thanksText': 'Сурамжылоо анонимдүү: тандалган варианттар гана сакталды. Жоопторуңуз тармакка пайдалуу жана түшүнүктүү материалдарды даярдоого жардам берет.',
  'survey.done': 'Сиз бул сурамжылоого катыштыңыз',
  'survey.doneText': 'Рахмат! Бул түзмөктөн жооп мурунтан эле сакталган.',
  'survey.again': 'Кайра жооп берүү',
  'survey.toTests': 'Тесттерге',
  'survey.intro': 'Анонимдүү · {q} · болжол менен {m} мүн',
  'survey.begin': 'Сурамжылоону баштоо',

  'profile.logout': 'Чыгуу',
  'profile.passed': 'Тапшырылган тесттер',
  'profile.avg': 'Орточо балл',
  'profile.results': 'Менин жыйынтыктарым',
  'profile.empty': 'Сиз азырынча тест тапшыра элексиз.',
  'profile.toTests': 'Тесттерге өтүү',
  'profile.test': 'Тест',
  'profile.result': 'Жыйынтык',
  'profile.date': 'Күнү',
  'profile.breakdown': 'Талдоо →',
  'profile.backResults': '← Менин жыйынтыктарым',
  'profile.retake': 'Тестти кайра тапшыруу',
  'profile.askBulb': 'BulbAIдан суроо',
  'profile.askBulbQ': '«{title}» тестиндеги каталарымды түшүндүрүп бер',

  'summary.right': 'Туура: {n}',
  'summary.wrongCount': 'Ката: {n}',
  'summary.wrong': 'Каталар ({n})',
  'summary.noWrong': 'Ката жок',
  'summary.allRight': 'Бардык жооптор туура.',
  'summary.rightList': 'Туура жооптор ({n})',
  'summary.answer': 'Жооп',
  'summary.noAnswer': 'Жооп жок',
  'summary.correct': 'Туура жооп',
  'summary.isCorrect': 'Жооп туура',
  'summary.noDetails': 'Бул аракет боюнча толук маалымат жок: ал жооптор жазыла баштаганга чейин сакталган.',

  'login.title': 'Кирүү',
  'login.register': 'Катталуу',
  'login.name': 'Аты-жөнү',
  'login.password': 'Сырсөз',
  'login.submit': 'Кирүү',
  'login.submitRegister': 'Катталуу',
  'login.toRegister': 'Аккаунтуңуз жокпу? Катталыңыз',
  'login.toLogin': 'Аккаунтуңуз барбы? Кириңиз',

  'ai.verified': '✓ Тастыкталды',
  'ai.fake': '✕ Фейк',
  'ai.doubt': '? Тастыкталган жок',
  'ai.warning': '! Этият болуңуз',
  'ai.ex1': 'WhatsAppта эртеңден баштап Бишкекте бир жумага мобилдик интернет өчүрүлөт деп жазышууда. Бул чынбы?',
  'ai.ex2': 'Жасалма сүрөттү чыныгысынан кантип айырмалоого болот?',
  'ai.ex3': '«Картаңыз бөгөттөлдү, шилтеме аркылуу өтүңүз» деген SMS келди. Эмне кылышым керек?',
  'ai.greeting': 'Салам! Мен BulbAIмын. Жаңылыкты, билдирүүнү же шилтемени жөнөтүңүз, мен анын чын же фейк экенин текшерүүгө жардам берем.',
  'ai.demoFallback': 'Азырынча мен демо режиминде иштеп, даярдалган суроолорго гана жооп берем. Төмөнкү суроолордун бирин тандаңыз, жакында каалаган билдирүүнү текшерүүнү үйрөнөм.',
  'ai.material': 'сайттагы материал',
  'ai.restart': 'Жакшы, кайрадан баштайлы. Эмнени текшеребиз?',
  'ai.analyze': 'Талдап жатам…',
  'ai.search': 'Булактарды издеп жатам…',
  'ai.speak': 'Жооп берип жатам…',
  'ai.ready': 'Жардам берүүгө даярмын',
  'ai.voiceOn': 'Үн күйүк',
  'ai.voiceOff': 'Үн өчүк',
  'ai.title': 'ЖИ-жардамчы',
  'ai.demo': 'Демо',
  'ai.demoText': 'Келечектеги жардамчынын демонстрациясы: жооптор алдын ала даярдалган.',
  'ai.liveText': 'Жаңылыктарды жана билдирүүлөрдү ишенимдүүлүккө текшерүү. Жардамчы жаңылышы мүмкүн: маанилүү маалыматты баштапкы булактардан текшериңиз.',
  'ai.newChat': 'Жаңы чат',
  'ai.thinking': 'Ойлонуп жатам…',
  'ai.more': 'Дагы суроолор',
  'ai.try': 'Суроо берип көрүңүз',
  'ai.placeholder': 'Жаңылыкты, билдирүүнү же шилтемени коюңуз…',
  'ai.check': 'Текшерүү',
  'ai.loginBefore': 'Жардамчыны колдонуу үчүн ',
  'ai.loginLink': 'кириңиз',
  'ai.loginAfter': '.',
}

const DICT: Record<Lang, Record<TKey, string>> = { ru, ky }

// Fixed admin-side vocabularies, shown translated on the portal.
const CATEGORY_KY: Record<string, string> = {
  'Право': 'Укук',
  'Безопасность': 'Коопсуздук',
  'Этика': 'Этика',
  'Проверка фактов': 'Фактыларды текшерүү',
}
const LEVEL_KY: Record<string, string> = { 'Базовый': 'Баштапкы', 'Средний': 'Орто', 'Продвинутый': 'Жогорку' }

type Vars = Record<string, string | number>

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey, vars?: Vars) => string
  /** "8 вопросов" / "8 суроо" */
  questions: (n: number) => string
  category: (c: string) => string
  level: (l: string) => string
}

const LangContext = createContext<LangState>(null!)

const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export function LangProvider({ children }: { children: ReactNode }) {
  // ?lang=ky / ?lang=ru in a link (e.g. a survey shared in a Kyrgyz chat) wins and is remembered.
  const [lang, setLangState] = useState<Lang>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('lang')
    if (fromUrl === 'ky' || fromUrl === 'ru') langStore.set(fromUrl)
    return langStore.get()
  })

  useEffect(() => {
    document.documentElement.lang = lang === 'ky' ? 'ky' : 'ru'
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    langStore.set(l)
    setLangState(l)
  }, [])

  const t = useCallback((key: TKey, vars?: Vars) => {
    let s = DICT[lang][key] ?? ru[key]
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
    return s
  }, [lang])

  const value: LangState = {
    lang,
    setLang,
    t,
    questions: (n) => (lang === 'ky' ? `${n} суроо` : `${n} ${ruPlural(n, 'вопрос', 'вопроса', 'вопросов')}`),
    category: (c) => (lang === 'ky' ? CATEGORY_KY[c] ?? c : c),
    level: (l) => (lang === 'ky' ? LEVEL_KY[l] ?? l : l),
  }
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)

/** RU / KG switch from the design: two compact segments in the header. */
export function LangSwitch() {
  const { lang, setLang, t } = useLang()
  return (
    <div className="lang-switch" role="group" aria-label={t('header.lang')}>
      <button type="button" className={lang === 'ru' ? 'active' : ''} aria-pressed={lang === 'ru'} onClick={() => setLang('ru')} lang="ru">RU</button>
      <button type="button" className={lang === 'ky' ? 'active' : ''} aria-pressed={lang === 'ky'} onClick={() => setLang('ky')} lang="ky">KG</button>
    </div>
  )
}
