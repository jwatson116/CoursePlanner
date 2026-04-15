The main section of this tool will contain a 3-month view of the upcoming term. You can switch to a weeks view as alterative. 

The layout for a smaller screen or a mobile will split the interface between 3 views: Filters, Schedule and Summary. 
There is a consistent header at the top of all 3 views. The Schedule can switch between month or week view. 
The week view fits Mon-Fri horizontally and 8:30 AM to 6:30 PM vertically

There is a subtle week number at the beginning of every week on the month and week view. It uses the Oxford weeks.

The uploaded Cohort data includes the long name of each course as its first field and the URL to the course page as its second field. 
Within this URL is a version of the shortname of the course. Other shortnames may be used.

There should be Cohort Filter as step 1 in the process. It should let you choose your degree type and your year. 
This will hide options from the lectures and groups so that only ones for that specific cohort are visible. 
Data about who can do which course will be uploaded as a CSV file, in the form of the Moodle report "This years course page links and cohorts"

Step 2 in the process is the the selection of Lectures. The information about which lectures happen when are contained in the the uploaded ics files. 
There will be a collapsible section called Lectures and you can select any of the courses to see their schedule appear on the calendar. 
It shows the courses' full names which are worked out using the cohort upload information and other provided instructions. E.g. Computational Medicine is also listed as Comp Med and CM, whereas Continuous Mathematics is also known as Cont Maths.
When a full name is truncated, you can hover over it with a mouse to see the full name. 
Next to the course name is a link to take you to the Moodle course page (URL in the cohort upload) and a delete icon.
The purpose of the delete icon is so that I can remove courses that I am not interested in. 
I should be able to reset it to bring them all back in with a "reset view" button. 
The reset view button should put courses that had been deleted back in the list but not change the selection status of any of the courses. 
The "Reset View" button only appears when there are actually hidden courses to restore

When a lecture course is chosen, the corresponding Classes and Practicals should appear in their own sections below the Lectures collapsible section. 
Also, in the summary pane, on the right, there will be a button next to the course name captioned "Add Groups" so the student can add all available groups and then remove ones that cause conflict. 
The data about what class and practical happens when will be uploaded as a cvs file, in the form of the file used to upload Groups data on Moodle. 
They will generally be named something line Practical-Groups-YYYY-MM-DD or Class-Groups-YYYY-MM-DD 

When there is a clash in selected events, it should be shown in the following ways:
- In the selection summary pane, and it should show which other item it clashes with
- In a summary box at the bottom, it should say the number of events that clash
- On the calendar, the dots should appear red and there should be a warning symbol on that day
- When you click on the day it should show which events are clashing

In the mobile view, when there is a clash, it will say at the bottom how many conflicts have been detected. There is no further information in this view, the user swtiches to either schedule or summary to find out more. The information about the conflicts is presented in a similar way to the desktop view.

You can resolve a clash by either
- unselecting it again from the selection pane on the left
- click on a cross on the summary pane on the right (this wil unselect it from the left)
- on the day view, click on a cross for one of the conflicting events (this wil unselect it from the left)

The drop down box for the upload files should have options in the following order: Cohort, Lectures, Practicals, Classes, Maths

The format for the Maths CSV file is as follows:
Cohort,Course Name,Day,Start Time,End Time,Weeks,Room
"Prelims","Multivariable Calculus","Monday","9:00","10:00","1-8","L1"
"Prelims","Dynamics","Monday","10:00","11:00","1-8","L1"
"Prelims","Linear Algebra II","Tuesday","9:00","10:00","1-4","L1"

The maths lectures should all appear in a collapsible section called Maths. Within that there should be sub groups of courses, separated by Maths cohort. 
You should be able to delete a who cohort of courses or individual ones like you can with the Computer Science lectures. 

There is no AI assistant

In the admin view, you can choose to add to a Change Log. 
In the student view, you cannot edit the change log.

There is an export function in the admin view. It lets you copy all of the uploaded data and change log, paste it into sampleData.ts and have the correct data in place for the deployed version.

This is a Light/Dark mode

Double clicking on the dark blue icon in the corner is a subtle way of switching between admin and student views. There should be no other way to switch modes.

When I upload anything, it should replace the existing corresponding data

