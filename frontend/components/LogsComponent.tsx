"use client";

import { useState, useEffect } from 'react';
import { DateNav } from './DateNav';

export default function LogsComponent() {
  const [date, setDate] = useState(new Date());
  const [text, setText] = useState(`Daily Log Entry - Sample Text

9:00 AM - Started the day with a cup of coffee and reviewed yesterday's notes. The weather looks promising for outdoor activities later.

9:30 AM - Team standup meeting. Discussed the new project requirements and timeline. Sarah mentioned some concerns about the API integration that we'll need to address.

10:15 AM - Deep work session on the authentication module. Made good progress on the JWT implementation. Need to add better error handling for expired tokens.

11:00 AM - Quick break to walk around the office. Sometimes stepping away from the screen helps clarify complex problems.

11:30 AM - Code review with Marcus. His suggestions for the database schema were spot on. We decided to add an index on the user_id column for better query performance.

12:00 PM - Lunch break. Had a great sandwich from the deli down the street. Also caught up with Emma about her recent trip to Portugal.

1:00 PM - Back to coding. Working on the user dashboard component. The layout is coming together nicely, but I need to optimize the data loading.

2:30 PM - Bug fixing session. Found and resolved three critical issues in the payment processing flow. Always satisfying to squash bugs.

3:15 PM - Client call to discuss project milestones. They're happy with the progress so far and approved the next phase of development.

4:00 PM - Documentation update. Added detailed comments to the API endpoints and updated the README file with new setup instructions.

4:45 PM - Testing the new features on staging environment. Everything looks good except for a minor CSS issue on mobile devices.

5:30 PM - Planning tomorrow's tasks. Priority items include:
- Fix the mobile CSS issue
- Implement user profile settings
- Set up the new monitoring dashboard
- Review pull requests from the team

6:00 PM - End of workday. Feeling productive and satisfied with today's accomplishments.

Personal Notes:
- Remember to buy groceries on the way home
- Call mom this evening
- Finish reading that React performance optimization article
- Plan weekend hiking trip

Technical Notes:
The new caching strategy seems to be working well. Page load times have improved by 40% since implementation.

Need to research:
- Best practices for microservices communication
- GraphQL vs REST API performance
- Docker container optimization techniques

Meeting Notes from Project Sync:
- Marketing team wants analytics dashboard by next Friday
- Legal department approved the new privacy policy
- Budget for additional server resources has been approved

Random Thoughts:
Today was a good balance of coding, meetings, and planning. The new workspace setup is really helping with productivity. The standing desk is a game changer.

Code snippet to remember:
const memoizedComponent = useMemo(() => {
  return <ExpensiveComponent data={complexData} />;
}, [complexData]);

This pattern has been super useful for optimizing re-renders in our React components.

Tomorrow's Weather: Sunny, 72°F - perfect for a walk during lunch break.

Book Recommendation: "Clean Code" by Robert Martin - re-reading this classic always provides new insights.

Podcast Listened To: "The Changelog" episode about WebAssembly. Fascinating discussion about the future of web performance.

Interesting Article: Found a great piece about database indexing strategies. Bookmarked for the team to review.

Personal Development Goal: Spend 30 minutes each day learning about cloud architecture patterns.

Team Appreciation: Big thanks to the QA team for their thorough testing of the latest release. Their attention to detail caught several edge cases we missed.

End of log entry.`);

  // load & save logic stays the same
  useEffect(() => {
    const saved = localStorage.getItem(date.toDateString());
    if (saved) setText(saved);
  }, [date]);

  // Auto-resize textarea when text changes
  useEffect(() => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [text]);
  const save = (value: string) => {
    setText(value);
    localStorage.setItem(date.toDateString(), value);
  };
  const goToPreviousDay = () => setDate(d => new Date(d.setDate(d.getDate() - 1)));
  const goToNextDay     = () => setDate(d => new Date(d.setDate(d.getDate() + 1)));

  return (
          <div className="h-full flex flex-col">
        <DateNav date={date} onPrevious={goToPreviousDay} onNext={goToNextDay} />
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-[100px] pt-[50px] pb-[100px]">
            <h1 className="text-3xl font-bold pb-[10px]">
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h1>

            <textarea
              className="w-full text-xs bg-background text-foreground
                         placeholder:text-muted-foreground focus:outline-none
                         resize-none border-none overflow-hidden min-h-[50vh]"
              style={{ height: 'auto', minHeight: '50vh' }}
              value={text}
              onChange={e => {
                setText(e.target.value);
                // Auto-resize textarea to fit content
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onBlur={e => save(e.target.value)}
              placeholder="Write your log for today…"
            />
          </div>
        </div>
      </div>
  );
}