EvidenceFit
GitHub Repo: https://github.com/hrithik-dev8/GenAI_Project.git
App URL: https://gen-ai-project-neon.vercel.app/


# Sourav Chindarmony - M01094141

EvidenceFit is a website that acts like a personal fitness coach. A user can give details about themselves, their age, weight, goals, what they like to eat and information regarding allergies. It creates a custom workout plan and meal plan just for them. It accepts pictures of someone's home gym and only suggest exercises they can actually do with the equipment they have.

The app stores a library of real, published health and exercise studies in its database. When a user asks for a plan, it searches through those studies to find the ones most relevant to that person's situation. Then it hands those studies to an AI assistant and asks it to write a plan backed by that real science. Four separate AI agents are working together: 
1. one works on the image uploaded to extract information regarding the equipment a user can access 
2. one designs the workout plan
3. one designs the meal plan
4. one writes a short explanation of why the plan makes sense. 
There is also a chat feature where someone can ask follow-up questions and the AI will answer using the same library of studies.

The website is built with React. The database and all the behind-the-scenes logic run on Supabase, an online service that stores data and runs server code. The AI agents are powered by large language models accessed through Groq's service. Everything talks to everything else through the internet, the person's browser talks to Supabase, and Supabase talks to the AI service, and the answers flow back to the screen.





# Hrithik Dev - M01096886

My app is called EvidenceFit, and the idea is pretty simple. It's a fitness coach you talk to through your browser. You tell it your weight, what you're trying to do (lose fat, build muscle, get stronger, etc), how many hours a week you can actually train, what you like to eat, and any allergies. In seconds it gives you a workout plan, a meal plan, and a chat box where you can ask it anything. For example : "why this many sets?" or "can I swap chicken for paneer?". The thing I wanted to avoid is what most fitness chatbots do, which is confidently making stuff up. So every answer mine gives comes with an actual sports-science paper attached to it, like a receipt(in references).

The AI side of it works as a few small AIs doing different jobs instead of one big one trying to do everything. If you upload a photo of your gym, a vision AI looks at the picture and figures out what equipment you have. Then a workout AI writes your training plan. A nutrition AI writes your meal plan. And a fourth one takes both plans and blends them into something that actually reads like a coach wrote it, not a robot. The chat is where the main trick lives. I stored a bunch of real research papers in a database, and every time you ask a question, the AI goes and pulls the papers that match your question first, reads them, and then answers, quoting them. That's called RAG. It's the reason the bot can't invent studies that don't exist. I also added some basic sanity checks so nobody can jailbreak it, and if somebody types something that sounds like a real medical emergency, it stops being a chatbot and tells them to call for help.

On the tech side, the website itself is React with TypeScript. Everything behind the scenes like user accounts, saved plans, chat history, the research paper library sits on Supabase, which uses pgvector to do the paper-matching. The actual AI logic runs in Supabase Edge Functions and is connected with LangChain. The brain answering everything is Llama 3.3 70B running on Groq, and OpenAI handles the embeddings for the paper search. The whole project is deployed on Vercel. 






# Netra Uchil - M01089309

EvidenceFit is a fitness app that you can access on your computer to help you achieve your fitness goals. You can start by entering your details such as your biodata (age, height, weight, etc.), what your goal is (lose weight, gain muscle), and then finally what are your diet preferences. This will allow the app to generate a workout plan and a diet plan for you to follow. We have an option where you can also add your available gym equipment to help us generate the workout more catered to you. The main concept of the app is that everything the app generates is backed by scientific research papers.

This is achieved by building a database of recent published studies on health and exercise. So when you submit your needs to the app, we go through the database to find studies that relate to your need the most. Once we find those, we have three AI agents that work on building the perfect plan for you. First we have an agent working on designing the workout for you; here, it also takes your gym photo into consideration (this handled by a fourth AI agent that deals with image computation), then we have an agent working on building a suitable diet for you that compliments your workout plan. Finally our last agent explains why the generated workout/diet plan is for you and presents the citations for the plan.

You can always refer to our chatbot, Coach, to ask any questions related to the generated plan or fitness and health in general

The stack as in the app's architecture is built as the following:
- The frontend is built on React
- The backend runs on Supabase, this is where we have our database and server code.
- The AI agents are powered by GROQ models, one is a LLM, one is a vision model

When you enter your details, you talk to Supabase, then Supabase picks out data relevant to your case and sends it over to the AI agents, who then bring the results to your screen.

