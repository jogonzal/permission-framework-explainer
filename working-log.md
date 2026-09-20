2:30pm: Created repo at https://github.com/jogonzal/permission-framework-explainer 
2:33pm: Install Claude for windows 🙂
2:40pm: Switch to Fable, prompt Claude for a permission framework that uses a DAG, and supports annotating resources and methods
2:46pm: Executing on the plan after design choices. Design includes a strongly typed schema to define permissions, APIs and resources, API functionality to validate and explain permissions, and tests
2:50pm: Brainstorm ideas for “example” usages of the permission framework. Include 5 examples of permission graphs including multiplayer gaming, healthcare, slack, Stripe and Github
3:02pm: Adding GitHub CI validation to the repo to ensure my changes don’t break it https://github.com/jogonzal/permission-framework-explainer/pull/1 
(Here, I decided to switch to using Cursor + Grok, as this is the tool I am more familiar with and am able to iterate quickly on, and I wanted to finish within 2 hours)
3:17pm: Framework and examples “done” moving on to creating a webapp so we can deploy/visualize instances of the framework on the web. Running the app locally so I can iterate quickly locally
3:38pm: Basic website is done, displays all examples and is now deployed to render.com under their free tier
https://permission-explainer.onrender.com/ 
3:40pm: Made the website look more “developer friendly”. Named it PERMCTL

3:50: A common debugging problem with permissions is understanding what would be required to remove a permission and backtracking why a permission is implied by another permission. Sometimes there’s many connections and middle layers to change. I am asking the agent to build tooling to make this kind of debugging simpler!
4:00 pm: I am adding another example with a much more complicated permission graph, so that it can show an example of how these debugging this can be really helpful
4:09pm: I am improving the permissions debugging tool to show exactly what modifications would be required to make in the YAML file (show it as a diff)
4:20pm: Ok! I think it is looking good. Ensuring things are deployed in render.com… done!
4:22pm: Now making a video/doc
4:29pm: Video is done! Now making a doc…
4:39pm: Exporting my prompts 🙂from both cursor and Claude

