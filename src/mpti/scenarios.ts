import type { Scenario } from './types';

// Original everyday scenarios; none are items from any commercial instrument.
export const SCENARIOS: Scenario[] = [
  { id: 'ei-saturday', dimension: 'EI', prompt: 'It is a free Saturday and a friend invites you to a crowded event at the last minute. What goes through your mind?', followUp: 'How would you feel about the evening afterwards, and what would you do the next day?' },
  { id: 'ei-newgroup', dimension: 'EI', prompt: 'You join a group where you only know one person. How do the first twenty minutes usually go for you?', followUp: 'What would make that situation feel easier or harder for you?' },
  { id: 'ei-hardweek', dimension: 'EI', prompt: 'After a draining week, what does a good evening look like, and who is in it?', followUp: 'What about that evening helps you reset?' },
  { id: 'sn-recipe', dimension: 'SN', prompt: 'You are given an unfamiliar task with a set of instructions. How do you approach it?', followUp: 'When have you decided to stray from the instructions, and why?' },
  { id: 'sn-describe', dimension: 'SN', prompt: 'Describe a place you love, the way you would to a friend who has never been there.', followUp: 'What do you most want your friend to understand about it?' },
  { id: 'sn-idea', dimension: 'SN', prompt: 'A teammate proposes an unusual idea nobody has tried. What is your first reaction?', followUp: 'What would you need to see before backing it, or dropping it?' },
  { id: 'tf-friend', dimension: 'TF', prompt: 'A friend is upset about a decision they already made, and you think it was a mistake. What do you do?', followUp: 'What matters most to you when you respond to them?' },
  { id: 'tf-split', dimension: 'TF', prompt: 'Your team is split between two options. One is better on paper, the other is what most people prefer. How do you choose?', followUp: 'What would settle it for you in the end?' },
  { id: 'tf-feedback', dimension: 'TF', prompt: 'You have to give someone feedback they will not enjoy hearing. How do you go about it?', followUp: 'What are you trying to protect when you give it?' },
  { id: 'jp-trip', dimension: 'JP', prompt: 'You are planning a week-long trip. What does your preparation look like?', followUp: 'What happens to your plan when something unexpected comes up?' },
  { id: 'jp-deadline', dimension: 'JP', prompt: 'You have a project due in two weeks. Walk me through how the time actually gets used.', followUp: 'How do you feel as the deadline gets closer?' },
  { id: 'jp-options', dimension: 'JP', prompt: 'You are choosing between several good options for something important. How do you wrap it up?', followUp: 'How do you know it is time to stop looking?' },
];
