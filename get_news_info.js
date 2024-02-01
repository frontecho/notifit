// import OpenAI from "openai";
const OpenAI = require('openai');
const openai = new OpenAI();

async function getNewsInfo(newsContent) {
    const completion = await openai.chat.completions.create({
        messages: [
            {
                role: "system",
                content: `用户将给你提供一个 通知/公告/新闻 的内容，你需要据此给出一个JSON格式的回复。具体如下，每个字段后的注释是可供选择的类型（除特殊说明，只能选择最接近的一项）。类似 "活动报名":"活动/岗位/人员 报名/招募" 这样的子类型，意思是“活动报名”这一子类别有一些提示 "活动/岗位/人员 报名/招募" 关于这些内容的都应该确定其子类别为 "活动报名"，注意不是把子类型名称定为"活动/岗位/人员 报名/招募"！！！
                {
                    "title": "", // 根据文章标题确定
                    "time": "", // 根据文章发布时间确定，格式为"YYYY-MM-DD[ HH:MM:SS]"，如果没有则为空字符串,"[ HH:MM:SS]"为可选部分
                    "from": "", // 根据最后署名或编辑发布人确定，如果没有则根据新闻源确定
                    "to": [], // 根据开头称谓或者文章内容确定，可多选，[所有人（除非特别通用，否则谨慎使用）/全体学生/XX级学生/各学院（系）/XX学院（系）/教师/职工/其他（谨慎使用）]
                    "type": "", // 根据文章内容确定，[通知/公告/新闻]
                    "subtype": "" // 通知:["日程安排","会议","专业与辅修":"专业/辅修","选课":"选课/课程开设停开/课程报名","课程通知":"课程通知/课堂/教材","讲座","考试","竞赛","评奖评优","活动开展":"活动/工作 开展通知（标题直接说明的）","活动报名":"活动/岗位/人员 报名/招募（标题直接说明的）","评鉴推选":"人员 评选/推荐（标题直接说明的）","申请申报":"项目/成绩 申请/申报（标题直接说明的）","图书馆":"图书馆/数据库资源",其他通知];公告:[人员名单公示,项目名单公示,值班安排,其他公示];新闻:[学院新闻,校内新闻,校外新闻,其他新闻]
                    "abstract": "", // 根据文章内容确定，文章摘要，至多100字
                }
                下面是一个例子：
                用户输入：{

                }`
            },
            {
                role: "user",
                content: newsContent
            },
        ],
        top_p: 0.1,
        model: "gpt-3.5-turbo-1106",
        response_format: { type: "json_object" },
    });
    console.log(completion.choices[0].message.content);
}

module.exports = getNewsInfo;